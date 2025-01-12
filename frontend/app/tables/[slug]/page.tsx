"use client";

import { useState, useEffect } from "react";
import { DataTable } from "../../../components/data-table";
import { AddDataForm } from "../../../components/add-data-form";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";
import { SearchBar } from "../../../components/search-bar";
import { Sidebar } from "../../../components/sidebar";
import { Header } from "../../../components/header";

const columns = [
  {
    accessorKey: "",
    header: "File Name",
    cell: ({ row }: { row: any }) => {
      const source = row.original._source;
      return source?.properties?.properties?.file_name || "N/A";
    },
  },
  {
    accessorKey: "textContent",
    header: "Text Content",
    cell: ({ row }: { row: any }) => {
      const source = row.original._source;
      return source?.properties?.text_representation || "N/A";
    },
  },
  {
    accessorKey: "pageNumber",
    header: "Page Number",
    cell: ({ row }: { row: any }) => {
      const source = row.original._source;
      const props = source?.properties?.properties;
      if (!props) return "N/A";
      return `${props.page_number}`;
    },
  },
];

export default function TablePage({ params }: { params: { slug: string } }) {
  const [data, setData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDataFormOpen, setIsAddDataFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [tableName, setTableName] = useState<string>("");

  const fetchDocuments = async (query?: string) => {
    try {
      if (query) {
        setIsSearching(true);
        console.log("Searching with query:", query);
      }
      const documents = query
        ? await api.searchDocuments(query, params.slug)
        : await api.getAllDocuments(params.slug);

      console.log("Raw API response:", documents);

      setData(documents || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const fetchTableInfo = async () => {
      try {
        const table = await api.getTableByID(params.slug);
        setTableName(table.table_name);
      } catch (error) {
        console.error("Error fetching table info:", error);
      }
    };

    fetchTableInfo();
    fetchDocuments().finally(() => setIsLoading(false));
  }, [params.slug]);

  const handleAddData = (newData: Record<string, string>) => {
    const newId = Math.max(...data.map((item) => item.id)) + 1;
    setData([...data, { id: newId, ...newData }]);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      await fetchDocuments(query);
    } else {
      await fetchDocuments();
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        Loading...
      </div>
    );
  }

  return (
    <div>
      <Header />
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold">
                {tableName || "Loading..."}
              </h1>
              <div className="space-x-2">
                <Button onClick={() => setIsAddDataFormOpen(true)}>
                  Add Data
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    window.navigator.clipboard.writeText(JSON.stringify(data))
                  }
                >
                  Share Table
                </Button>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center space-x-4">
                <SearchBar value={searchQuery} onSubmit={handleSearch} />
                {isSearching && (
                  <span className="text-gray-600 animate-pulse">
                    Searching...
                  </span>
                )}
              </div>
            </div>

            {data.length === 0 && !isSearching ? (
              <div className="text-center py-8 text-gray-500">
                No documents found. Click "Add Data" to create your first
                document.
              </div>
            ) : (
              <div className="relative">
                <DataTable columns={columns} data={data} />
              </div>
            )}

            <AddDataForm
              isOpen={isAddDataFormOpen}
              onClose={() => setIsAddDataFormOpen(false)}
              onFilesAccepted={handleAddData}
              tableName={tableName}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
