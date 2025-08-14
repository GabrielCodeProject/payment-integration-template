-- Security Monitoring and Intrusion Detection Setup
-- PCI DSS Compliant Database Security Monitoring
-- NextJS Stripe Payment Template

-- ============================================================================
-- SECURITY MONITORING TABLES
-- ============================================================================

-- Create security monitoring schema
CREATE SCHEMA IF NOT EXISTS security_monitoring;

-- Security events log table
CREATE TABLE security_monitoring.security_events (
    id BIGSERIAL PRIMARY KEY,
    event_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    username VARCHAR(63),
    database_name VARCHAR(63),
    client_addr INET,
    client_hostname TEXT,
    application_name TEXT,
    event_details JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(63),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Failed authentication attempts table
CREATE TABLE security_monitoring.failed_auth_attempts (
    id BIGSERIAL PRIMARY KEY,
    attempt_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    username VARCHAR(63),
    client_addr INET,
    client_hostname TEXT,
    application_name TEXT,
    failure_reason TEXT,
    consecutive_failures INTEGER DEFAULT 1,
    blocked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suspicious activity log
CREATE TABLE security_monitoring.suspicious_activity (
    id BIGSERIAL PRIMARY KEY,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activity_type VARCHAR(100) NOT NULL,
    risk_score INTEGER CHECK (risk_score BETWEEN 1 AND 100),
    username VARCHAR(63),
    client_addr INET,
    query_text TEXT,
    session_id TEXT,
    pid INTEGER,
    activity_details JSONB,
    investigated BOOLEAN DEFAULT FALSE,
    investigation_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Connection monitoring table
CREATE TABLE security_monitoring.connection_events (
    id BIGSERIAL PRIMARY KEY,
    event_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_type VARCHAR(20) CHECK (event_type IN ('CONNECT', 'DISCONNECT')),
    username VARCHAR(63),
    database_name VARCHAR(63),
    client_addr INET,
    client_hostname TEXT,
    application_name TEXT,
    session_duration INTERVAL,
    queries_executed INTEGER,
    bytes_sent BIGINT,
    bytes_received BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Security events indexes
CREATE INDEX idx_security_events_time ON security_monitoring.security_events (event_time);
CREATE INDEX idx_security_events_type ON security_monitoring.security_events (event_type);
CREATE INDEX idx_security_events_severity ON security_monitoring.security_events (severity);
CREATE INDEX idx_security_events_username ON security_monitoring.security_events (username);
CREATE INDEX idx_security_events_client_addr ON security_monitoring.security_events (client_addr);
CREATE INDEX idx_security_events_unresolved ON security_monitoring.security_events (resolved) WHERE resolved = FALSE;

-- Failed auth attempts indexes
CREATE INDEX idx_failed_auth_time ON security_monitoring.failed_auth_attempts (attempt_time);
CREATE INDEX idx_failed_auth_username ON security_monitoring.failed_auth_attempts (username);
CREATE INDEX idx_failed_auth_client_addr ON security_monitoring.failed_auth_attempts (client_addr);
CREATE INDEX idx_failed_auth_blocked ON security_monitoring.failed_auth_attempts (blocked_until) WHERE blocked_until IS NOT NULL;

-- Suspicious activity indexes
CREATE INDEX idx_suspicious_activity_time ON security_monitoring.suspicious_activity (detected_at);
CREATE INDEX idx_suspicious_activity_type ON security_monitoring.suspicious_activity (activity_type);
CREATE INDEX idx_suspicious_activity_risk ON security_monitoring.suspicious_activity (risk_score);
CREATE INDEX idx_suspicious_activity_username ON security_monitoring.suspicious_activity (username);
CREATE INDEX idx_suspicious_activity_uninvestigated ON security_monitoring.suspicious_activity (investigated) WHERE investigated = FALSE;

-- Connection events indexes
CREATE INDEX idx_connection_events_time ON security_monitoring.connection_events (event_time);
CREATE INDEX idx_connection_events_type ON security_monitoring.connection_events (event_type);
CREATE INDEX idx_connection_events_username ON security_monitoring.connection_events (username);
CREATE INDEX idx_connection_events_client_addr ON security_monitoring.connection_events (client_addr);

-- ============================================================================
-- SECURITY MONITORING FUNCTIONS
-- ============================================================================

-- Function to log security events
CREATE OR REPLACE FUNCTION security_monitoring.log_security_event(
    p_event_type VARCHAR(50),
    p_severity VARCHAR(20),
    p_username VARCHAR(63) DEFAULT NULL,
    p_database_name VARCHAR(63) DEFAULT NULL,
    p_client_addr INET DEFAULT NULL,
    p_client_hostname TEXT DEFAULT NULL,
    p_application_name TEXT DEFAULT NULL,
    p_event_details JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO security_monitoring.security_events (
        event_type, severity, username, database_name, 
        client_addr, client_hostname, application_name, event_details
    ) VALUES (
        p_event_type, p_severity, p_username, p_database_name,
        p_client_addr, p_client_hostname, p_application_name, p_event_details
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track failed authentication attempts
CREATE OR REPLACE FUNCTION security_monitoring.track_failed_auth(
    p_username VARCHAR(63),
    p_client_addr INET,
    p_client_hostname TEXT DEFAULT NULL,
    p_application_name TEXT DEFAULT NULL,
    p_failure_reason TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    consecutive_count INTEGER;
    block_duration INTERVAL;
BEGIN
    -- Get current consecutive failure count
    SELECT COALESCE(consecutive_failures, 0) + 1 
    INTO consecutive_count
    FROM security_monitoring.failed_auth_attempts 
    WHERE username = p_username 
      AND client_addr = p_client_addr 
      AND attempt_time > NOW() - INTERVAL '1 hour'
    ORDER BY attempt_time DESC 
    LIMIT 1;
    
    -- Determine block duration based on consecutive failures
    CASE 
        WHEN consecutive_count >= 10 THEN block_duration := INTERVAL '24 hours';
        WHEN consecutive_count >= 5 THEN block_duration := INTERVAL '1 hour';
        WHEN consecutive_count >= 3 THEN block_duration := INTERVAL '15 minutes';
        ELSE block_duration := NULL;
    END CASE;
    
    -- Insert failed attempt record
    INSERT INTO security_monitoring.failed_auth_attempts (
        username, client_addr, client_hostname, application_name,
        failure_reason, consecutive_failures, blocked_until
    ) VALUES (
        p_username, p_client_addr, p_client_hostname, p_application_name,
        p_failure_reason, consecutive_count, 
        CASE WHEN block_duration IS NOT NULL THEN NOW() + block_duration ELSE NULL END
    );
    
    -- Log security event for multiple failures
    IF consecutive_count >= 3 THEN
        PERFORM security_monitoring.log_security_event(
            'MULTIPLE_AUTH_FAILURES',
            CASE WHEN consecutive_count >= 10 THEN 'CRITICAL'
                 WHEN consecutive_count >= 5 THEN 'HIGH'
                 ELSE 'MEDIUM' END,
            p_username,
            current_database(),
            p_client_addr,
            p_client_hostname,
            p_application_name,
            jsonb_build_object(
                'consecutive_failures', consecutive_count,
                'blocked_until', NOW() + block_duration,
                'failure_reason', p_failure_reason
            )
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to detect suspicious query patterns
CREATE OR REPLACE FUNCTION security_monitoring.detect_suspicious_query(
    p_query TEXT,
    p_username VARCHAR(63),
    p_client_addr INET DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    risk_score INTEGER := 0;
    activity_type VARCHAR(100) := 'QUERY_ANALYSIS';
    suspicious_patterns TEXT[] := ARRAY[
        'UNION.*SELECT',
        'OR.*1.*=.*1',
        'DROP.*TABLE',
        'DELETE.*FROM.*WHERE.*1.*=.*1',
        'INSERT.*INTO.*pg_',
        'UPDATE.*pg_',
        'COPY.*FROM',
        '/\*.*\*/',
        'xp_cmdshell',
        'sp_executesql',
        'BULK.*INSERT',
        'OPENROWSET'
    ];
    pattern TEXT;
BEGIN
    -- Convert query to uppercase for pattern matching
    p_query := UPPER(p_query);
    
    -- Check for suspicious patterns
    FOREACH pattern IN ARRAY suspicious_patterns LOOP
        IF p_query ~ pattern THEN
            risk_score := risk_score + 25;
            activity_type := 'SUSPICIOUS_SQL_PATTERN';
        END IF;
    END LOOP;
    
    -- Check for excessive UNION statements (potential SQL injection)
    IF (LENGTH(p_query) - LENGTH(REPLACE(p_query, 'UNION', ''))) / 5 > 2 THEN
        risk_score := risk_score + 30;
        activity_type := 'EXCESSIVE_UNION_STATEMENTS';
    END IF;
    
    -- Check for unusually long queries (potential injection)
    IF LENGTH(p_query) > 10000 THEN
        risk_score := risk_score + 20;
        activity_type := 'UNUSUALLY_LONG_QUERY';
    END IF;
    
    -- Log suspicious activity if risk score is significant
    IF risk_score >= 25 THEN
        INSERT INTO security_monitoring.suspicious_activity (
            activity_type, risk_score, username, client_addr, query_text,
            activity_details
        ) VALUES (
            activity_type, LEAST(risk_score, 100), p_username, p_client_addr, p_query,
            jsonb_build_object(
                'patterns_matched', suspicious_patterns,
                'query_length', LENGTH(p_query),
                'detection_time', NOW()
            )
        );
        
        -- Log high-risk security event
        IF risk_score >= 75 THEN
            PERFORM security_monitoring.log_security_event(
                'HIGH_RISK_QUERY_DETECTED',
                'HIGH',
                p_username,
                current_database(),
                p_client_addr,
                NULL,
                NULL,
                jsonb_build_object(
                    'risk_score', risk_score,
                    'activity_type', activity_type,
                    'query_preview', LEFT(p_query, 200)
                )
            );
        END IF;
    END IF;
    
    RETURN risk_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECURITY MONITORING VIEWS
-- ============================================================================

-- Real-time security dashboard view
CREATE OR REPLACE VIEW security_monitoring.security_dashboard AS
SELECT 
    'active_threats' as metric,
    COUNT(*) as value,
    'HIGH and CRITICAL unresolved security events' as description
FROM security_monitoring.security_events 
WHERE resolved = FALSE 
  AND severity IN ('HIGH', 'CRITICAL')
  AND event_time > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
    'failed_auth_24h' as metric,
    COUNT(*) as value,
    'Failed authentication attempts in last 24 hours' as description
FROM security_monitoring.failed_auth_attempts 
WHERE attempt_time > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
    'blocked_ips' as metric,
    COUNT(DISTINCT client_addr) as value,
    'Currently blocked IP addresses' as description
FROM security_monitoring.failed_auth_attempts 
WHERE blocked_until > NOW()

UNION ALL

SELECT 
    'suspicious_activity_24h' as metric,
    COUNT(*) as value,
    'Suspicious activities detected in last 24 hours' as description
FROM security_monitoring.suspicious_activity 
WHERE detected_at > NOW() - INTERVAL '24 hours'
  AND risk_score >= 50;

-- Active connections security view
CREATE OR REPLACE VIEW security_monitoring.active_connections_security AS
SELECT 
    pid,
    usename,
    datname,
    client_addr,
    client_hostname,
    client_port,
    application_name,
    backend_start,
    state,
    query_start,
    CASE 
        WHEN client_addr IS NULL THEN 'LOCAL'
        WHEN client_addr::TEXT LIKE '192.168.%' 
          OR client_addr::TEXT LIKE '10.%' 
          OR client_addr::TEXT LIKE '172.16.%' 
          OR client_addr::TEXT LIKE '172.17.%' 
          OR client_addr::TEXT LIKE '172.18.%' 
          OR client_addr::TEXT LIKE '172.19.%' 
          OR client_addr::TEXT LIKE '172.2%' 
          OR client_addr::TEXT LIKE '172.30.%' 
          OR client_addr::TEXT LIKE '172.31.%' THEN 'INTERNAL'
        ELSE 'EXTERNAL'
    END as connection_type,
    CASE 
        WHEN usename NOT IN ('app_readwrite', 'app_readonly', 'app_monitor', 'pgbouncer_admin') 
        THEN 'SUSPICIOUS_USER'
        WHEN application_name NOT LIKE '%payment-template%' 
         AND application_name NOT LIKE '%pgbouncer%'
         AND application_name NOT LIKE '%psql%' THEN 'SUSPICIOUS_APP'
        ELSE 'NORMAL'
    END as risk_assessment
FROM pg_stat_activity 
WHERE datname = current_database()
  AND pid != pg_backend_pid();

-- Recent security events summary
CREATE OR REPLACE VIEW security_monitoring.recent_security_events AS
SELECT 
    event_time,
    event_type,
    severity,
    username,
    client_addr,
    application_name,
    event_details,
    resolved,
    CASE 
        WHEN event_time > NOW() - INTERVAL '1 hour' THEN 'RECENT'
        WHEN event_time > NOW() - INTERVAL '24 hours' THEN 'TODAY'
        WHEN event_time > NOW() - INTERVAL '7 days' THEN 'THIS_WEEK'
        ELSE 'OLDER'
    END as time_category
FROM security_monitoring.security_events 
WHERE event_time > NOW() - INTERVAL '30 days'
ORDER BY event_time DESC;

-- ============================================================================
-- PERMISSIONS FOR SECURITY MONITORING
-- ============================================================================

-- Grant monitoring access to designated roles
GRANT USAGE ON SCHEMA security_monitoring TO app_monitor;
GRANT SELECT ON ALL TABLES IN SCHEMA security_monitoring TO app_monitor;
GRANT SELECT ON ALL VIEWS IN SCHEMA security_monitoring TO app_monitor;

-- Grant limited access to read-only users for security reporting
GRANT USAGE ON SCHEMA security_monitoring TO app_readonly;
GRANT SELECT ON security_monitoring.security_dashboard TO app_readonly;
GRANT SELECT ON security_monitoring.recent_security_events TO app_readonly;

-- Grant administrative access to security functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA security_monitoring TO app_readwrite;

-- ============================================================================
-- AUTOMATED CLEANUP AND MAINTENANCE
-- ============================================================================

-- Function to clean up old monitoring data
CREATE OR REPLACE FUNCTION security_monitoring.cleanup_old_data(
    p_retention_days INTEGER DEFAULT 90
) RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Clean up old security events (keep for compliance)
    DELETE FROM security_monitoring.security_events 
    WHERE event_time < NOW() - (p_retention_days || ' days')::INTERVAL
      AND resolved = TRUE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean up old failed auth attempts
    DELETE FROM security_monitoring.failed_auth_attempts 
    WHERE attempt_time < NOW() - (p_retention_days || ' days')::INTERVAL;
    
    -- Clean up resolved suspicious activity
    DELETE FROM security_monitoring.suspicious_activity 
    WHERE detected_at < NOW() - (p_retention_days || ' days')::INTERVAL
      AND investigated = TRUE;
    
    -- Clean up old connection events
    DELETE FROM security_monitoring.connection_events 
    WHERE event_time < NOW() - (p_retention_days || ' days')::INTERVAL;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log monitoring setup completion
INSERT INTO security_monitoring.security_events (
    event_type, severity, event_details
) VALUES (
    'MONITORING_SYSTEM_INITIALIZED',
    'LOW',
    jsonb_build_object(
        'setup_time', NOW(),
        'tables_created', 4,
        'functions_created', 4,
        'views_created', 3,
        'monitoring_status', 'ACTIVE'
    )
);

-- Display setup completion message
SELECT 
    'Security monitoring system initialized successfully!' as status,
    'Tables: security_events, failed_auth_attempts, suspicious_activity, connection_events' as tables,
    'Functions: log_security_event, track_failed_auth, detect_suspicious_query, cleanup_old_data' as functions,
    'Views: security_dashboard, active_connections_security, recent_security_events' as views;