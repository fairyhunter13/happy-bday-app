-- PostgreSQL initialization script
-- Runs on first container startup (docker-entrypoint-initdb.d)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_stat_statements for query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create database if not exists (already created by POSTGRES_DB env var)
-- This script runs after database creation

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE birthday_app TO postgres;

-- Set timezone to UTC (important for consistency)
SET timezone = 'UTC';

-- Display extensions
SELECT extname, extversion FROM pg_extension;
