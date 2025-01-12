import pyarrow.fs
import sycamore
import json
import os
from elasticsearch import Elasticsearch
from sycamore.data import Document
from sycamore.functions.tokenizer import OpenAITokenizer
from sycamore.llms import AnthropicModels, Anthropic
from sycamore.transforms import COALESCE_WHITESPACE
from sycamore.transforms.merge_elements import GreedySectionMerger
from sycamore.transforms.partition import ArynPartitioner
from sycamore.transforms.embed import OpenAIEmbedder
from sycamore.materialize_config import MaterializeSourceMode
from sycamore.utils.pdf_utils import show_pages
from sycamore.transforms.summarize_images import SummarizeImages
from sycamore.context import ExecMode

from dotenv import load_dotenv

load_dotenv()


# Sycamore uses lazy execution for efficiency, so the ETL pipeline will only execute when running cells with specific functions.


def process_documents(file_path, file_name, user_id, table_id):
    print("file_path", file_path)
    print("file_name", file_name)
    print("user_id", user_id)
    print("table_id", table_id)

    # Initialize the Sycamore context
    ctx = sycamore.init(ExecMode.LOCAL)
    # Set the embedding model and its parameters
    model_name = "text-embedding-3-small"
    max_tokens = 8191
    dimensions = 1536
    # Initialize the tokenizer
    tokenizer = OpenAITokenizer(model_name)

    print("test1")

    ds = (
        ctx.read.binary(file_path, binary_format="pdf")
        # Partition and extract tables and images
        .partition(
            partitioner=ArynPartitioner(
                threshold="auto",
                use_ocr=True,
                extract_table_structure=True,
                extract_images=True,
            )
        )
        # Use materialize to cache output. If changing upstream code or input files, change setting from USE_STORED to RECOMPUTE to create a new cache.
        .materialize(
            path="./materialize/partitioned",
            source_mode=MaterializeSourceMode.USE_STORED,
        )
        # Merge elements into larger chunks
        .merge(
            merger=GreedySectionMerger(
                tokenizer=tokenizer, max_tokens=max_tokens, merge_across_pages=False
            )
        )
        # Split elements that are too big to embed
        .split_elements(tokenizer=tokenizer, max_tokens=max_tokens)
        .map(
            lambda d: (
                d.properties.update(
                    {
                        "user_id": user_id,
                        "file_name": file_name,
                        "table_id": table_id,
                        "path": file_path,
                    }
                ),
                d,
            )[1]
        )
    )

    ds.execute()

    embedded_ds = (
        # Copy document properties to each Document's sub-elements
        ds.spread_properties(
            ["path", "entity", "file_name", "user_id", "table_id", "file_name"]
        )
        # Convert all Elements to Documents
        .explode()
        # Embed each Document. You can change the embedding model. Make your target vector index matches this number of dimensions.
        .embed(embedder=OpenAIEmbedder(model_name=model_name))
    )
    # To know more about docset transforms, please visit https://sycamore.readthedocs.io/en/latest/sycamore/transforms.html
    print(embedded_ds.show())

    # Write to a persistent Elasticsearch Index. Note: You must have a specified elasticsearch instance running for this to work.
    # For more information on how to set one up, refer to https://www.elastic.co/guide/en/elasticsearch/reference/current/install-elasticsearch.html
    url = "https://cc3161c1876b4d0c80715ef38d4eeeb6.us-west1.gcp.cloud.es.io:443"
    index_name = "sbhacks"
    embedded_ds.write.elasticsearch(
        url=url,
        index_name=index_name,
        es_client_args={"api_key": os.getenv("ELASTICSEARCH_API_KEY")},
        mappings={
            "properties": {
                "embeddings": {
                    "type": "dense_vector",
                    "dims": dimensions,
                    "index": True,
                    "similarity": "cosine",
                },
            },
        },
    )

    return {"status": "success", "message": "Documents processed successfully"}


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 5:
        print("Usage: python doc_upload.py file_path file_name user_id table_name")
        sys.exit(1)

    file_path = sys.argv[1]
    file_name = sys.argv[2]
    user_id = sys.argv[3]
    table_name = sys.argv[4]

    process_documents(file_path, file_name, user_id, table_name)
