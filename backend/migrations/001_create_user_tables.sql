-- Create user_tables table
CREATE TABLE IF NOT EXISTS user_tables (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    table_id TEXT NOT NULL UNIQUE,
    table_name TEXT NOT NULL,
    public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, table_name)
);
