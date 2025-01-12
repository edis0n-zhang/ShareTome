package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
	_ "github.com/joho/godotenv/autoload"
)

// Service represents a service that interacts with a database.
type Service interface {
	// Health returns a map of health status information.
	// The keys and values in the map are service-specific.
	Health() map[string]string

	// Close terminates the database connection.
	// It returns an error if the connection cannot be closed.
	Close() error

	// CreateUserTable inserts a new record into the user_tables table
	CreateUserTable(ctx context.Context, userID, tableName string, isPublic bool) (string, error)

	// GetUserTables retrieves all tables for a given user
	GetUserTables(ctx context.Context, userID string) ([]UserTable, error)

	// TableExists checks if a table with the given name already exists for the user
	TableExists(ctx context.Context, userID, tableName string) (bool, error)

	// GetTableByID retrieves a table by its ID
	GetTableByID(ctx context.Context, tableID string) (*UserTable, error)

	// UpdateTableVisibility updates the visibility of a table
	UpdateTableVisibility(ctx context.Context, tableID string, isPublic bool) error
}

type service struct {
	db *sql.DB
}

type UserTable struct {
	TableID   string `json:"table_id"`
	TableName string `json:"table_name"`
	IsPublic  bool   `json:"public"`
}

var (
	database   = os.Getenv("BLUEPRINT_DB_DATABASE")
	password   = os.Getenv("BLUEPRINT_DB_PASSWORD")
	username   = os.Getenv("BLUEPRINT_DB_USERNAME")
	port       = os.Getenv("BLUEPRINT_DB_PORT")
	host       = os.Getenv("BLUEPRINT_DB_HOST")
	schema     = os.Getenv("BLUEPRINT_DB_SCHEMA")
	dbInstance *service
)

func New() Service {
	// Reuse Connection
	if dbInstance != nil {
		return dbInstance
	}
	connStr := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable&search_path=%s", username, password, host, port, database, schema)
	db, err := sql.Open("pgx", connStr)
	if err != nil {
		log.Fatal(err)
	}
	dbInstance = &service{
		db: db,
	}
	return dbInstance
}

// Health checks the health of the database connection by pinging the database.
// It returns a map with keys indicating various health statistics.
func (s *service) Health() map[string]string {
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	stats := make(map[string]string)

	// Ping the database
	err := s.db.PingContext(ctx)
	if err != nil {
		stats["status"] = "down"
		stats["error"] = fmt.Sprintf("db down: %v", err)
		log.Fatalf("db down: %v", err) // Log the error and terminate the program
		return stats
	}

	// Database is up, add more statistics
	stats["status"] = "up"
	stats["message"] = "It's healthy"

	// Get database stats (like open connections, in use, idle, etc.)
	dbStats := s.db.Stats()
	stats["open_connections"] = strconv.Itoa(dbStats.OpenConnections)
	stats["in_use"] = strconv.Itoa(dbStats.InUse)
	stats["idle"] = strconv.Itoa(dbStats.Idle)
	stats["wait_count"] = strconv.FormatInt(dbStats.WaitCount, 10)
	stats["wait_duration"] = dbStats.WaitDuration.String()
	stats["max_idle_closed"] = strconv.FormatInt(dbStats.MaxIdleClosed, 10)
	stats["max_lifetime_closed"] = strconv.FormatInt(dbStats.MaxLifetimeClosed, 10)

	// Evaluate stats to provide a health message
	if dbStats.OpenConnections > 40 { // Assuming 50 is the max for this example
		stats["message"] = "The database is experiencing heavy load."
	}

	if dbStats.WaitCount > 1000 {
		stats["message"] = "The database has a high number of wait events, indicating potential bottlenecks."
	}

	if dbStats.MaxIdleClosed > int64(dbStats.OpenConnections)/2 {
		stats["message"] = "Many idle connections are being closed, consider revising the connection pool settings."
	}

	if dbStats.MaxLifetimeClosed > int64(dbStats.OpenConnections)/2 {
		stats["message"] = "Many connections are being closed due to max lifetime, consider increasing max lifetime or revising the connection usage pattern."
	}

	return stats
}

// Close closes the database connection.
// It logs a message indicating the disconnection from the specific database.
// If the connection is successfully closed, it returns nil.
// If an error occurs while closing the connection, it returns the error.
func (s *service) Close() error {
	log.Printf("Disconnected from database: %s", database)
	return s.db.Close()
}

// CreateUserTable inserts a new record into the user_tables table
func (s *service) CreateUserTable(ctx context.Context, userID, tableName string, isPublic bool) (string, error) {
	fmt.Println("dbcreate 1")
	tableID := uuid.New().String()
	
	query := `
		INSERT INTO user_tables (user_id, table_id, table_name, public)
		VALUES ($1, $2, $3, $4)
		RETURNING table_id`
	
	var returnedTableID string
	err := s.db.QueryRowContext(ctx, query, userID, tableID, tableName, isPublic).Scan(&returnedTableID)
	if err != nil {
		return "", fmt.Errorf("failed to create user table: %v", err)
	}
	
	return returnedTableID, nil
}

// GetUserTables retrieves all tables for a given user from the database
func (s *service) GetUserTables(ctx context.Context, userID string) ([]UserTable, error) {
	query := `
		SELECT table_id, table_name, public
		FROM user_tables
		WHERE user_id = $1
		ORDER BY table_name`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query user tables: %v", err)
	}
	defer rows.Close()

	var tables []UserTable
	for rows.Next() {
		var table UserTable
		if err := rows.Scan(&table.TableID, &table.TableName, &table.IsPublic); err != nil {
			return nil, fmt.Errorf("failed to scan user table row: %v", err)
		}
		tables = append(tables, table)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating user table rows: %v", err)
	}

	return tables, nil
}

// TableExists checks if a table with the given name already exists for the user
func (s *service) TableExists(ctx context.Context, userID, tableName string) (bool, error) {
	query := `
		SELECT EXISTS (
			SELECT 1 FROM user_tables 
			WHERE user_id = $1 AND table_name = $2
		)`
	
	var exists bool
	err := s.db.QueryRowContext(ctx, query, userID, tableName).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check table existence: %v", err)
	}
	
	return exists, nil
}

// GetTableByID retrieves a table by its ID from the database
func (s *service) GetTableByID(ctx context.Context, tableID string) (*UserTable, error) {
	query := `
		SELECT table_id, table_name, public
		FROM user_tables
		WHERE table_id = $1
	`

	var table UserTable
	err := s.db.QueryRowContext(ctx, query, tableID).Scan(&table.TableID, &table.TableName, &table.IsPublic)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("error getting table by ID: %v", err)
	}

	return &table, nil
}

// UpdateTableVisibility updates the visibility of a table in the database
func (s *service) UpdateTableVisibility(ctx context.Context, tableID string, isPublic bool) error {
	query := `UPDATE user_tables SET public = $1 WHERE table_id = $2`
	result, err := s.db.ExecContext(ctx, query, isPublic, tableID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("table not found")
	}

	return nil
}
