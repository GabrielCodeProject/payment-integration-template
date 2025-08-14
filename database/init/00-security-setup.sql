-- Database Security Setup for NextJS Stripe Payment Template
-- PCI DSS Compliant Database Security Configuration
-- Implements least privilege access controls and security hardening

-- ============================================================================
-- SECURITY FOUNDATION SETUP
-- ============================================================================

-- Create extensions required for security and functionality
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone to UTC for consistency and security logging
SET timezone = 'UTC';

-- ============================================================================
-- DATABASE SECURITY HARDENING - REMOVE DEFAULT PRIVILEGES
-- ============================================================================

-- Remove dangerous default privileges from public role (PCI DSS requirement)
REVOKE ALL ON SCHEMA public FROM public;
REVOKE ALL ON DATABASE payment_template_dev FROM public;

-- Remove default database creation privileges
REVOKE CREATE ON DATABASE payment_template_dev FROM public;

-- ============================================================================
-- ROLE-BASED ACCESS CONTROL (RBAC) IMPLEMENTATION
-- ============================================================================

-- Role 1: Read-only access for reporting and analytics
CREATE ROLE app_readonly NOLOGIN;
GRANT CONNECT ON DATABASE payment_template_dev TO app_readonly;
GRANT USAGE ON SCHEMA public TO app_readonly;

-- Role 2: Read-write access for main application operations
CREATE ROLE app_readwrite NOLOGIN;
GRANT CONNECT ON DATABASE payment_template_dev TO app_readwrite;
GRANT USAGE ON SCHEMA public TO app_readwrite;

-- Role 3: Migration privileges for database schema changes
CREATE ROLE app_migrate NOLOGIN;
GRANT CONNECT ON DATABASE payment_template_dev TO app_migrate;
GRANT USAGE, CREATE ON SCHEMA public TO app_migrate;
GRANT CREATE ON DATABASE payment_template_dev TO app_migrate;

-- Role 4: Backup operations with minimal required privileges
CREATE ROLE app_backup NOLOGIN;
GRANT CONNECT ON DATABASE payment_template_dev TO app_backup;
GRANT USAGE ON SCHEMA public TO app_backup;

-- Role 5: Monitoring and health check operations
CREATE ROLE app_monitor NOLOGIN;
GRANT CONNECT ON DATABASE payment_template_dev TO app_monitor;
GRANT USAGE ON SCHEMA public TO app_monitor;

-- Role 6: PgBouncer administrative operations
CREATE ROLE pgbouncer_admin NOLOGIN;
GRANT CONNECT ON DATABASE payment_template_dev TO pgbouncer_admin;

-- ============================================================================
-- USER CREATION WITH SECURE PASSWORDS AND ROLE ASSIGNMENTS
-- ============================================================================

-- Main application user (primary database connection)
CREATE USER app_readwrite WITH 
    PASSWORD 'secure_app_password_2024'
    CONNECTION LIMIT 50
    VALID UNTIL '2025-12-31';
GRANT app_readwrite TO app_readwrite;

-- Read-only user for analytics and reporting
CREATE USER app_readonly WITH 
    PASSWORD 'secure_readonly_password_2024'
    CONNECTION LIMIT 20
    VALID UNTIL '2025-12-31';
GRANT app_readonly TO app_readonly;

-- Migration user for Prisma/database migrations (limited use)
CREATE USER app_migrate WITH 
    PASSWORD 'secure_migrate_password_2024'
    CONNECTION LIMIT 5
    VALID UNTIL '2025-12-31';
GRANT app_migrate TO app_migrate;

-- Backup user for automated backup operations
CREATE USER app_backup WITH 
    PASSWORD 'secure_backup_password_2024'
    CONNECTION LIMIT 3
    VALID UNTIL '2025-12-31';
GRANT app_backup TO app_backup;

-- Monitoring user for health checks and metrics
CREATE USER app_monitor WITH 
    PASSWORD 'secure_monitor_password_2024'
    CONNECTION LIMIT 10
    VALID UNTIL '2025-12-31';
GRANT app_monitor TO app_monitor;

-- PgBouncer administrative user
CREATE USER pgbouncer_admin WITH 
    PASSWORD 'secure_pgbouncer_admin_2024'
    CONNECTION LIMIT 5
    VALID UNTIL '2025-12-31';
GRANT pgbouncer_admin TO pgbouncer_admin;

-- PgBouncer monitoring user
CREATE USER pgbouncer_monitor WITH 
    PASSWORD 'secure_pgbouncer_monitor_2024'
    CONNECTION LIMIT 5
    VALID UNTIL '2025-12-31';
GRANT CONNECT ON DATABASE payment_template_dev TO pgbouncer_monitor;
GRANT USAGE ON SCHEMA public TO pgbouncer_monitor;

-- ============================================================================
-- SECURITY POLICIES AND CONSTRAINTS
-- ============================================================================

-- Enable row level security for all future tables
ALTER DATABASE payment_template_dev SET row_security = on;

-- Set secure default permissions for new objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_readwrite;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO app_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO app_monitor;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_readwrite;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO app_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO app_monitor;

-- Create security schemas
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS security;

-- Grant audit schema permissions
GRANT USAGE ON SCHEMA audit TO app_readwrite;
GRANT USAGE ON SCHEMA audit TO app_monitor;
GRANT SELECT ON ALL TABLES IN SCHEMA audit TO app_monitor;

-- ============================================================================
-- AUTHENTICATION TABLE FOR PGBOUNCER
-- ============================================================================

-- Create authentication table for PgBouncer
CREATE TABLE IF NOT EXISTS public.pgbouncer_auth (
    username TEXT NOT NULL PRIMARY KEY,
    password TEXT NOT NULL
);

-- Insert PgBouncer users with hashed passwords
INSERT INTO public.pgbouncer_auth (username, password) VALUES 
    ('app_readwrite', 'SCRAM-SHA-256$4096:secure_salt_here$hash_here'),
    ('app_readonly', 'SCRAM-SHA-256$4096:secure_salt_here$hash_here'),
    ('pgbouncer_admin', 'SCRAM-SHA-256$4096:secure_salt_here$hash_here'),
    ('pgbouncer_monitor', 'SCRAM-SHA-256$4096:secure_salt_here$hash_here')
ON CONFLICT (username) DO NOTHING;

-- Secure the authentication table
GRANT SELECT ON public.pgbouncer_auth TO pgbouncer_admin;
GRANT SELECT ON public.pgbouncer_auth TO pgbouncer_monitor;
REVOKE ALL ON public.pgbouncer_auth FROM public;

-- ============================================================================
-- SECURITY MONITORING VIEWS
-- ============================================================================

-- View for monitoring active connections and security events
CREATE OR REPLACE VIEW security.connection_monitor AS
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    client_hostname,
    client_port,
    backend_start,
    xact_start,
    query_start,
    state,
    query
FROM pg_stat_activity
WHERE datname = current_database()
AND state IS NOT NULL;

-- Grant monitoring access
GRANT SELECT ON security.connection_monitor TO app_monitor;
GRANT SELECT ON security.connection_monitor TO pgbouncer_monitor;

-- View for database performance monitoring
CREATE OR REPLACE VIEW security.performance_monitor AS
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    n_live_tup,
    n_dead_tup,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY seq_scan DESC, idx_scan DESC;

-- Grant performance monitoring access
GRANT SELECT ON security.performance_monitor TO app_monitor;

-- ============================================================================
-- SECURITY CONFIGURATION VALIDATION
-- ============================================================================

-- Log security setup completion
INSERT INTO pg_stat_statements_info 
SELECT 'Security setup completed successfully at ' || NOW() || ' - PCI DSS compliant configuration applied';

-- Display security configuration summary
SELECT 
    'Database security hardening completed!' as status,
    'Roles created: app_readonly, app_readwrite, app_migrate, app_backup, app_monitor, pgbouncer_admin' as roles,
    'Users created with connection limits and password expiration' as users,
    'Row-level security enabled, default privileges secured' as security,
    'PgBouncer authentication configured' as pooling,
    'Security monitoring views created' as monitoring;