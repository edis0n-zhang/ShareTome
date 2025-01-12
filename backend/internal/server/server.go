package server

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/elastic/go-elasticsearch/v8"
	_ "github.com/joho/godotenv/autoload"

	"backend/internal/database"
)

type Server struct {
	port int

	db database.Service
	es *elasticsearch.Client
}

func NewServer() *http.Server {
	port, _ := strconv.Atoi(os.Getenv("PORT"))
	
	// Initialize Elasticsearch client with configuration
	cfg := elasticsearch.Config{
		Addresses: []string{os.Getenv("ELASTICSEARCH_URL")},
		APIKey:    os.Getenv("ELASTICSEARCH_API_KEY"),
	}
	
	esClient, err := elasticsearch.NewClient(cfg)
	if err != nil {
		panic(fmt.Sprintf("Error creating Elasticsearch client: %s", err))
	}

	NewServer := &Server{
		port: port,

		db: database.New(),
		es: esClient,
	}

	// Declare Server config
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", NewServer.port),
		Handler:      NewServer.RegisterRoutes(),
		IdleTimeout:  time.Minute,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	return server
}
