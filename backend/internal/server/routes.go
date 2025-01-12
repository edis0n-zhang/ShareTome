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
	fmt.Println("1")

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
			"term": map[string]interface{}{
				"properties.properties.user_id": "test",
			},
		},
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
	var result map[string]interface{}
	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		http.Error(w, fmt.Sprintf("Error parsing the response: %s", err), http.StatusInternalServerError)
		return
	}

	fmt.Println("4")
	// Print all documents to server logs
	if hits, ok := result["hits"].(map[string]interface{}); ok {
		if innerHits, ok := hits["hits"].([]interface{}); ok {
			log.Printf("Found %d documents:", len(innerHits))
			for i, hit := range innerHits {
				if doc, ok := hit.(map[string]interface{}); ok {
					docBytes, _ := json.MarshalIndent(doc["_source"], "", "  ")
					log.Printf("Document %d:\n%s\n", i+1, string(docBytes))
				}
			}
		}
	}

	// Send the response
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(result); err != nil {
		log.Printf("Failed to write response: %v", err)
	}
}

func mustToJSON(data interface{}) string {
	jsonData, err := json.Marshal(data)
	if err != nil {
		log.Fatalf("Failed to marshal data to JSON: %v", err)
	}
	return string(jsonData)
}
