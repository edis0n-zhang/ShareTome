package server

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
)

func (s *Server) RegisterRoutes() http.Handler {
	mux := http.NewServeMux()

	// Register routes
	mux.HandleFunc("/es/search", s.searchDocumentsHandler) // Search endpoint
	mux.HandleFunc("/es/all", s.getAllDocumentsHandler) // More specific routes first
	mux.HandleFunc("/health", s.healthHandler)
	mux.HandleFunc("/hello", s.HelloWorldHandler) // Move hello world to /hello endpoint

	// Wrap the mux with CORS middleware
	return s.corsMiddleware(mux)
}

func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*") // Replace "*" with specific origins if needed
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, X-CSRF-Token")
		w.Header().Set("Access-Control-Allow-Credentials", "false") // Set to "true" if credentials are required

		// Handle preflight OPTIONS requests
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		// Proceed with the next handler
		//
		next.ServeHTTP(w, r)
	})
}

func (s *Server) HelloWorldHandler(w http.ResponseWriter, r *http.Request) {
	resp := map[string]string{"message": "Hello World"}
	jsonResp, err := json.Marshal(resp)
	if err != nil {
		http.Error(w, "Failed to marshal response", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if _, err := w.Write(jsonResp); err != nil {
		log.Printf("Failed to write response: %v", err)
	}
}

func (s *Server) healthHandler(w http.ResponseWriter, r *http.Request) {
	resp, err := json.Marshal(s.db.Health())
	if err != nil {
		http.Error(w, "Failed to marshal health check response", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if _, err := w.Write(resp); err != nil {
		log.Printf("Failed to write response: %v", err)
	}
}

func (s *Server) getAllDocumentsHandler(w http.ResponseWriter, r *http.Request) {
	// Print out the auth token from the request header
	// Print out the HTTP request details
	log.Printf("Request Method: %s", r.Method)
	log.Printf("Request URL: %s", r.URL)
	log.Printf("Request Headers: %v", r.Header)
	log.Printf("Request RemoteAddr: %s", r.RemoteAddr)

	authToken := r.Header.Get("Authorization")
	log.Printf("Auth Token: %s", authToken)

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	indexName := os.Getenv("ELASTICSEARCH_INDEX")
	if indexName == "" {
		http.Error(w, "Elasticsearch index not configured", http.StatusInternalServerError)
		return
	}

	fmt.Println("2")

	// Create a search request for documents with user_id "test"
	query := map[string]interface{}{
		"query": map[string]interface{}{
			"match_all": map[string]interface{}{}, // For now, get all documents
		},
		"_source": []string{"properties", "text_representation"},
	}

	res, err := s.es.Search(
		s.es.Search.WithContext(r.Context()),
		s.es.Search.WithIndex(indexName),
		s.es.Search.WithSize(1000), // Limit to 1000 documents for safety
		s.es.Search.WithBody(strings.NewReader(mustToJSON(query))),
	)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error searching documents: %s", err), http.StatusInternalServerError)
		return
	}
	defer res.Body.Close()

	fmt.Println("3")
	// Read the response body
	var queryResult map[string]interface{}
	if err := json.NewDecoder(res.Body).Decode(&queryResult); err != nil {
		http.Error(w, fmt.Sprintf("Error parsing the response: %s", err), http.StatusInternalServerError)
		return
	}

	fmt.Println("4")
	result := queryResult["hits"].(map[string]interface{})
	hits := result["hits"].([]interface{})

	fmt.Println("5")
	// Send the response
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(hits); err != nil {
		log.Printf("Failed to write response: %v", err)
	}
}

func (s *Server) searchDocumentsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Query parameter 'q' is required", http.StatusBadRequest)
		return
	}

	// embed query using text-embedding-3-small
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		http.Error(w, "OpenAI API key not configured", http.StatusInternalServerError)
		return
	}

	// Get embedding for the query
	queryVector, err := getEmbedding(query, apiKey)
	if err != nil {
		log.Printf("Error getting embedding: %s", err)
		http.Error(w, "Failed to process query", http.StatusInternalServerError)
		return
	}

	log.Printf("Query: %s", query)
	log.Printf("Query Vector length: %d", len(queryVector))
	if len(queryVector) > 0 {
		log.Printf("First few values: %v", queryVector[:5])
	}

	// Prepare the search request
	searchRequest := map[string]interface{}{
		"knn": map[string]interface{}{
			"field":           "embedding",
			"query_vector":    queryVector,
			"k":              10,
			"num_candidates": 100,
		},
		"_source": []string{"properties", "text_representation"},
	}

	// Convert the search request to JSON
	searchBody := strings.NewReader(mustToJSON(searchRequest))

	indexName := os.Getenv("ELASTICSEARCH_INDEX")
	if indexName == "" {
		http.Error(w, "Elasticsearch index not configured", http.StatusInternalServerError)
		return
	}

	// Perform the search
	res, err := s.es.Search(
		s.es.Search.WithContext(r.Context()),
		s.es.Search.WithIndex(indexName),
		s.es.Search.WithBody(searchBody),
		s.es.Search.WithSize(1000), // Limit to 1000 documents for safety
		s.es.Search.WithTrackTotalHits(true),
	)
	if err != nil {
		log.Printf("Error searching documents: %s", err)
		http.Error(w, "Failed to search documents", http.StatusInternalServerError)
		return
	}
	defer res.Body.Close()

	// Parse the response
	var searchResult map[string]interface{}
	if err := json.NewDecoder(res.Body).Decode(&searchResult); err != nil {
		log.Printf("Error parsing search response: %s", err)
		http.Error(w, "Failed to parse search results", http.StatusInternalServerError)
		return
	}

	// Extract just the hits array
	result := searchResult["hits"].(map[string]interface{})
	hits := result["hits"].([]interface{})
	
	// Print out the hits
	for _, hit := range hits {
		log.Printf("Hit: %v", hit)
	}

	fmt.Printf("5")

	// Send the response
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(hits); err != nil {
		log.Printf("Error encoding search results: %s", err)
		http.Error(w, "Failed to encode search results", http.StatusInternalServerError)
		return
	}
}

func mustToJSON(data interface{}) string {
	jsonData, err := json.Marshal(data)
	if err != nil {
		log.Fatalf("Failed to marshal data to JSON: %v", err)
	}
	return string(jsonData)
}
