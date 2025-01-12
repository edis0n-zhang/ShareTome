package server

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

func (s *Server) RegisterRoutes() http.Handler {
	mux := http.NewServeMux()

	// Register routes
	mux.HandleFunc("/es/search", s.searchDocumentsHandler) // Search endpoint
	mux.HandleFunc("/es/all", s.getAllDocumentsHandler)    // More specific routes first
	mux.HandleFunc("/health", s.healthHandler)
	mux.HandleFunc("/hello", s.HelloWorldHandler) // Move hello world to /hello endpoint
	mux.HandleFunc("/create_table", s.createUserTableHandler)
	mux.HandleFunc("/tables", s.getUserTablesHandler)
	mux.HandleFunc("/upload", s.uploadHandler) // Add upload endpoint
	mux.HandleFunc("/table", s.getTableByIDHandler) // Add get table by ID endpoint
	mux.HandleFunc("/table/", s.updateTableVisibilityHandler) // Add update table visibility endpoint

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
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	tableID := r.URL.Query().Get("table_id")
	if tableID == "" {
		http.Error(w, "Query parameter 'table_id' is required", http.StatusBadRequest)
		return
	}

	authToken := r.Header.Get("Authorization")
	log.Printf("getAllDocumentsHandler: Received Authorization header: %s", authToken)
	userID := ""
	if strings.HasPrefix(authToken, "Bearer ") {
		userID = strings.TrimPrefix(authToken, "Bearer ")
	}
	if userID == "" {
		log.Printf("getAllDocumentsHandler: Invalid or missing Authorization header from %s", r.RemoteAddr)
		http.Error(w, "Invalid or missing Authorization header", http.StatusUnauthorized)
		return
	}

	indexName := os.Getenv("ELASTICSEARCH_INDEX")
	if indexName == "" {
		http.Error(w, "Elasticsearch index not configured", http.StatusInternalServerError)
		return
	}

	// Create a search request that filters by table_id and user_id
	query := map[string]interface{}{
		"query": map[string]interface{}{
			"bool": map[string]interface{}{
				"must": []map[string]interface{}{
					{
						"match": map[string]interface{}{
							"properties.properties.table_id": tableID,
						},
					},
					{
						"match": map[string]interface{}{
							"properties.properties.user_id": userID,
						},
					},
				},
			},
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
		log.Printf("Error searching documents: %s", err)
		http.Error(w, fmt.Sprintf("Error searching documents: %s", err), http.StatusInternalServerError)
		return
	}
	defer res.Body.Close()

	// Read the response body
	var queryResult map[string]interface{}
	if err := json.NewDecoder(res.Body).Decode(&queryResult); err != nil {
		log.Printf("Error parsing search response: %s", err)
		http.Error(w, fmt.Sprintf("Error parsing the response: %s", err), http.StatusInternalServerError)
		return
	}

	result := queryResult["hits"].(map[string]interface{})
	hits := result["hits"].([]interface{})

	// Print out the hits for debugging
	for _, hit := range hits {
		log.Printf("Hit: %v", hit)
	}

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

	tableID := r.URL.Query().Get("table_id")
	if tableID == "" {
		http.Error(w, "Query parameter 'table_id' is required", http.StatusBadRequest)
		return
	}

	authToken := r.Header.Get("Authorization")
	log.Printf("uploadHandler: Received Authorization header: %s", authToken)
	userID := ""
	if strings.HasPrefix(authToken, "Bearer ") {
		userID = strings.TrimPrefix(authToken, "Bearer ")
	}
	if userID == "" {
		log.Printf("uploadHandler: Invalid or missing Authorization header from %s", r.RemoteAddr)
		http.Error(w, "Invalid or missing Authorization header", http.StatusUnauthorized)
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
		"query": map[string]interface{}{
			"bool": map[string]interface{}{
				"must": []map[string]interface{}{
					{
						"match": map[string]interface{}{
							"properties.properties.table_id": tableID,
						},
					},
					{
						"match": map[string]interface{}{
							"properties.properties.user_id": userID,
						},
					},
				},
			},
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

func (s *Server) uploadHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("uploadHandler: Received POST request to /upload from %s", r.RemoteAddr)

	if r.Method != http.MethodPost {
		log.Printf("uploadHandler: Invalid method %s from %s", r.Method, r.RemoteAddr)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract user ID from Authorization header
	authToken := r.Header.Get("Authorization")
	log.Printf("uploadHandler: Received Authorization header: %s", authToken)
	userID := ""
	if strings.HasPrefix(authToken, "Bearer ") {
		userID = strings.TrimPrefix(authToken, "Bearer ")
	}
	if userID == "" {
		log.Printf("uploadHandler: Invalid or missing Authorization header from %s", r.RemoteAddr)
		http.Error(w, "Invalid or missing Authorization header", http.StatusUnauthorized)
		return
	}

	// Parse the multipart form with a reasonable max memory
	if err := r.ParseMultipartForm(32 << 20); err != nil { // 32MB max memory
		log.Printf("uploadHandler: Failed to parse form: %v", err)
		http.Error(w, fmt.Sprintf("Failed to parse form: %v", err), http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		log.Printf("uploadHandler: Failed to get file from form: %v", err)
		http.Error(w, fmt.Sprintf("Failed to get file from form: %v", err), http.StatusBadRequest)
		return
	}
	defer file.Close()

	log.Printf("uploadHandler: Received file %s of size %d and type %s", 
		header.Filename, header.Size, header.Header.Get("Content-Type"))

	// Create uploads directory if it doesn't exist
	uploadsDir := filepath.Join("uploads", userID)
	absPath, _ := filepath.Abs(uploadsDir)
	log.Printf("uploadHandler: Creating directory at %s", absPath)

	// Create the directory
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		http.Error(w, fmt.Sprintf("Error creating uploads directory: %s", err), http.StatusInternalServerError)
		return
	}

	// Create a unique filename to avoid collisions
	filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), header.Filename)
	filePath := filepath.Join(uploadsDir, filename)

	log.Println("uploadHandler: Saving file to", filePath)

	// Create the file
	dst, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "Failed to create file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// Copy the uploaded file to the destination file
	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}

	// Return the file path
	response := map[string]string{"filePath": filePath}
	log.Println("uploadHandler: Response", response)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

type createUserTableRequest struct {
	TableName         string     `json:"table_name"`
	IsPublic         bool       `json:"is_public"`
	Documents        []Document `json:"documents"`
	SkipTableCreation bool       `json:"skip_table_creation"`
}

type Document struct {
	FilePath string `json:"file_path"`
	FileName string `json:"file_name"`
}

func (s *Server) createUserTableHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("createUserTableHandler: Received %s request to %s", r.Method, r.URL.Path)
	log.Printf("Headers: %v", r.Header)

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract user ID from Authorization header
	authToken := r.Header.Get("Authorization")
	userID := ""
	if strings.HasPrefix(authToken, "Bearer ") {
		userID = strings.TrimPrefix(authToken, "Bearer ")
	}
	if userID == "" {
		http.Error(w, "Invalid or missing Authorization header", http.StatusUnauthorized)
		return
	}
	log.Printf("User ID: %s", userID)

	var req createUserTableRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	log.Printf("Request body: %+v", req)

	ctx := r.Context()
	var tableID string
	var err error

	if !req.SkipTableCreation {
		tableID, err = s.db.CreateUserTable(ctx, userID, req.TableName, req.IsPublic)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to create table: %v", err), http.StatusInternalServerError)
			return
		}
	} else {
		// If skipping table creation, get the existing table ID
		tables, err := s.db.GetUserTables(ctx, userID)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to get user tables: %v", err), http.StatusInternalServerError)
			return
		}
		
		// Find the matching table
		found := false
		for _, table := range tables {
			if table.TableName == req.TableName {
				tableID = table.TableID
				found = true
				break
			}
		}
		
		if !found {
			http.Error(w, "Table not found", http.StatusNotFound)
			return
		}
	}

	// Process uploaded documents if any
	if len(req.Documents) > 0 {
		// Get the directory of the current file
		_, currentFile, _, _ := runtime.Caller(0)
		scriptPath := filepath.Join(filepath.Dir(currentFile), "doc_upload.py")
		for _, doc := range req.Documents {
			// Prepare command arguments
			cmdArgs := append([]string{scriptPath}, doc.FilePath, doc.FileName, userID, tableID)

			log.Println("Executing command:", cmdArgs)

			cmd := exec.Command("python3", cmdArgs...)

			// Capture both stdout and stderr
			output, err := cmd.CombinedOutput()
			if err != nil {
				log.Printf("Script execution failed for document %s: %v\nOutput: %s", doc.FilePath, err, output)
				// Continue execution as document processing error shouldn't fail table creation
				continue
			}

			log.Printf("Successfully processed document %s. Output:\n%s", doc.FilePath, output)
		}
	}

	response := map[string]string{"table_id": tableID}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
	log.Printf("Successfully created table %s for user %s", tableID, userID)
}

func (s *Server) getUserTablesHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("getUserTablesHandler: Received %s request to %s", r.Method, r.URL.Path)
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract user ID from Authorization header
	authToken := r.Header.Get("Authorization")
	userID := ""
	if strings.HasPrefix(authToken, "Bearer ") {
		userID = strings.TrimPrefix(authToken, "Bearer ")
	}
	if userID == "" {
		http.Error(w, "Invalid or missing Authorization header", http.StatusUnauthorized)
		return
	}
	log.Printf("User ID: %s", userID)

	ctx := r.Context()
	tables, err := s.db.GetUserTables(ctx, userID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get user tables: %v", err), http.StatusInternalServerError)
		return
	}
	

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(tables); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

func (s *Server) getTableByIDHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("getTableByIDHandler: Received %s request to %s", r.Method, r.URL.Path)
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	tableID := r.URL.Query().Get("table_id")
	if tableID == "" {
		http.Error(w, "table_id is required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	table, err := s.db.GetTableByID(ctx, tableID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error getting table: %v", err), http.StatusInternalServerError)
		return
	}

	if table == nil {
		http.Error(w, "Table not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(table); err != nil {
		log.Printf("Error encoding response: %v", err)
	}
}

type updateTableVisibilityRequest struct {
	IsPublic bool `json:"is_public"`
}

func (s *Server) updateTableVisibilityHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract table ID from URL path
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) != 4 || pathParts[3] != "visibility" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	tableID := pathParts[2]

	// Parse request body
	var req updateTableVisibilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Update table visibility in database
	ctx := r.Context()
	err := s.db.UpdateTableVisibility(ctx, tableID, req.IsPublic)
	if err != nil {
		if err.Error() == "table not found" {
			http.Error(w, "Table not found", http.StatusNotFound)
			return
		}
		log.Printf("Error updating table visibility: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func mustToJSON(data interface{}) string {
	jsonData, err := json.Marshal(data)
	if err != nil {
		log.Fatalf("Failed to marshal data to JSON: %v", err)
	}
	return string(jsonData)
}
