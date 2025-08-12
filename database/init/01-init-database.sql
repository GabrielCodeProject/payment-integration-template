-- PostgreSQL Database Initialization Script
-- NextJS Stripe Payment Template

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create additional databases for testing if needed
CREATE DATABASE payment_template_test;
CREATE DATABASE payment_template_staging;

-- Create additional users with limited permissions
CREATE USER app_user WITH PASSWORD 'app_password';
CREATE USER readonly_user WITH PASSWORD 'readonly_password';

-- Grant permissions for app_user
GRANT CONNECT ON DATABASE payment_template_dev TO app_user;
GRANT CONNECT ON DATABASE payment_template_test TO app_user;

-- Connect to main database to set up schemas and permissions
\c payment_template_dev;

-- Create schemas if needed
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Grant schema permissions
GRANT USAGE ON SCHEMA public TO app_user;
GRANT USAGE ON SCHEMA audit TO app_user;
GRANT USAGE ON SCHEMA analytics TO app_user;

-- Grant table creation permissions for migrations
GRANT CREATE ON SCHEMA public TO app_user;
GRANT CREATE ON SCHEMA audit TO app_user;

-- Grant permissions for readonly user
GRANT CONNECT ON DATABASE payment_template_dev TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT USAGE ON SCHEMA audit TO readonly_user;
GRANT USAGE ON SCHEMA analytics TO readonly_user;

-- Create a function to automatically grant permissions on new tables
CREATE OR REPLACE FUNCTION grant_permissions_on_new_table()
RETURNS event_trigger AS $$
BEGIN
    -- Grant permissions to app_user on new tables
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_user', 
                   tg_table_name);
    
    -- Grant read permissions to readonly_user on new tables  
    EXECUTE format('GRANT SELECT ON %I TO readonly_user', 
                   tg_table_name);
END;
$$ LANGUAGE plpgsql;

-- Create event trigger for automatic permission granting
CREATE EVENT TRIGGER grant_permissions_trigger
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE')
EXECUTE FUNCTION grant_permissions_on_new_table();

-- Create performance monitoring views
CREATE OR REPLACE VIEW performance_stats AS
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public'
ORDER BY tablename, attname;

-- Create a view for monitoring database connections
CREATE OR REPLACE VIEW connection_stats AS
SELECT 
    datname as database_name,
    numbackends as active_connections,
    xact_commit as transactions_committed,
    xact_rollback as transactions_rolled_back,
    blks_read as blocks_read,
    blks_hit as blocks_hit,
    tup_returned as tuples_returned,
    tup_fetched as tuples_fetched,
    tup_inserted as tuples_inserted,
    tup_updated as tuples_updated,
    tup_deleted as tuples_deleted
FROM pg_stat_database 
WHERE datname IN ('payment_template_dev', 'payment_template_test', 'payment_template_staging');

-- Log initialization completion
INSERT INTO pg_stat_statements_info VALUES ('Database initialized successfully at ' || NOW());

-- Display completion message
SELECT 'Database initialization completed successfully!' as status;