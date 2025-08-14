-- Comprehensive Audit Logging System
-- NextJS Stripe Payment Template
-- Automatic audit trail for critical data changes

\c payment_template_dev;

-- =============================================
-- AUDIT TRIGGER FUNCTIONS
-- =============================================

-- Generic audit trigger function for automatic audit logging
CREATE OR REPLACE FUNCTION audit_trigger_function() 
RETURNS TRIGGER AS $$
DECLARE
    old_values JSON;
    new_values JSON;
    changed_fields TEXT[];
    current_user_id TEXT;
    current_user_email TEXT;
    current_ip TEXT;
    current_user_agent TEXT;
    current_session_id TEXT;
    current_request_id TEXT;
BEGIN
    -- Initialize variables
    old_values := NULL;
    new_values := NULL;
    changed_fields := ARRAY[]::TEXT[];
    
    -- Get current session context (these would be set by application)
    current_user_id := current_setting('audit.user_id', true);
    current_user_email := current_setting('audit.user_email', true);
    current_ip := current_setting('audit.ip_address', true);
    current_user_agent := current_setting('audit.user_agent', true);
    current_session_id := current_setting('audit.session_id', true);
    current_request_id := current_setting('audit.request_id', true);
    
    -- Handle different trigger operations
    IF TG_OP = 'INSERT' THEN
        new_values := to_json(NEW);
        
        INSERT INTO audit_logs (
            "id", "tableName", "recordId", "action", "userId", "userEmail",
            "ipAddress", "userAgent", "oldValues", "newValues",
            "changedFields", "sessionId", "requestId", "metadata"
        ) VALUES (
            'audit-' || extract(epoch from now())::text || '-' || floor(random() * 10000)::text,
            TG_TABLE_NAME, NEW.id::TEXT, 'CREATE',
            NULLIF(current_user_id, ''), NULLIF(current_user_email, ''),
            NULLIF(current_ip, ''), NULLIF(current_user_agent, ''),
            NULL, new_values,
            ARRAY[]::TEXT[], NULLIF(current_session_id, ''), NULLIF(current_request_id, ''),
            json_build_object('operation', 'INSERT', 'table_name', TG_TABLE_NAME)
        );
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        old_values := to_json(OLD);
        new_values := to_json(NEW);
        
        -- Identify changed fields
        changed_fields := audit_get_changed_fields(OLD, NEW);
        
        -- Only log if there are actual changes
        IF array_length(changed_fields, 1) > 0 THEN
            INSERT INTO audit_logs (
                "id", "tableName", "recordId", "action", "userId", "userEmail",
                "ipAddress", "userAgent", "oldValues", "newValues",
                "changedFields", "sessionId", "requestId", "metadata"
            ) VALUES (
                'audit-' || extract(epoch from now())::text || '-' || floor(random() * 10000)::text,
                TG_TABLE_NAME, NEW.id::TEXT, 'UPDATE',
                NULLIF(current_user_id, ''), NULLIF(current_user_email, ''),
                NULLIF(current_ip, ''), NULLIF(current_user_agent, ''),
                old_values, new_values,
                changed_fields, NULLIF(current_session_id, ''), NULLIF(current_request_id, ''),
                json_build_object(
                    'operation', 'UPDATE',
                    'table_name', TG_TABLE_NAME,
                    'changes_count', array_length(changed_fields, 1)
                )
            );
        END IF;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        old_values := to_json(OLD);
        
        INSERT INTO audit_logs (
            "id", "tableName", "recordId", "action", "userId", "userEmail",
            "ipAddress", "userAgent", "oldValues", "newValues",
            "changedFields", "sessionId", "requestId", "metadata"
        ) VALUES (
            'audit-' || extract(epoch from now())::text || '-' || floor(random() * 10000)::text,
            TG_TABLE_NAME, OLD.id::TEXT, 'DELETE',
            NULLIF(current_user_id, ''), NULLIF(current_user_email, ''),
            NULLIF(current_ip, ''), NULLIF(current_user_agent, ''),
            old_values, NULL,
            ARRAY[]::TEXT[], NULLIF(current_session_id, ''), NULLIF(current_request_id, ''),
            json_build_object('operation', 'DELETE', 'table_name', TG_TABLE_NAME)
        );
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to identify changed fields between old and new records
CREATE OR REPLACE FUNCTION audit_get_changed_fields(old_record JSONB, new_record JSONB)
RETURNS TEXT[] AS $$
DECLARE
    changed_fields TEXT[] := ARRAY[]::TEXT[];
    key TEXT;
    old_val JSONB;
    new_val JSONB;
BEGIN
    -- Compare each field
    FOR key IN SELECT jsonb_object_keys(new_record) LOOP
        old_val := old_record->key;
        new_val := new_record->key;
        
        -- Skip timestamp fields that auto-update
        IF key IN ('updated_at', 'updatedAt') THEN
            CONTINUE;
        END IF;
        
        -- Check if values are different
        IF (old_val IS NULL AND new_val IS NOT NULL) OR
           (old_val IS NOT NULL AND new_val IS NULL) OR
           (old_val != new_val) THEN
            changed_fields := array_append(changed_fields, key);
        END IF;
    END LOOP;
    
    RETURN changed_fields;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Enhanced trigger function for sensitive tables (users, payment_methods)
CREATE OR REPLACE FUNCTION audit_sensitive_trigger_function() 
RETURNS TRIGGER AS $$
DECLARE
    old_values JSON;
    new_values JSON;
    changed_fields TEXT[];
    current_user_id TEXT;
    current_user_email TEXT;
    current_ip TEXT;
    current_user_agent TEXT;
    current_session_id TEXT;
    current_request_id TEXT;
    sensitive_fields TEXT[] := ARRAY['hashedPassword', 'email', 'phone', 'stripeCustomerId', 'stripePaymentMethodId'];
    field_name TEXT;
BEGIN
    -- Get current session context
    current_user_id := current_setting('audit.user_id', true);
    current_user_email := current_setting('audit.user_email', true);
    current_ip := current_setting('audit.ip_address', true);
    current_user_agent := current_setting('audit.user_agent', true);
    current_session_id := current_setting('audit.session_id', true);
    current_request_id := current_setting('audit.request_id', true);
    
    IF TG_OP = 'INSERT' THEN
        new_values := to_json(NEW);
        
        -- Mask sensitive data in new_values
        FOR field_name IN SELECT unnest(sensitive_fields) LOOP
            IF (new_values::JSONB) ? field_name AND ((new_values::JSONB)->>field_name) IS NOT NULL THEN
                new_values := jsonb_set(new_values::JSONB, ARRAY[field_name], '"[MASKED]"'::JSONB);
            END IF;
        END LOOP;
        
        INSERT INTO audit_logs (
            "id", "tableName", "recordId", "action", "userId", "userEmail",
            "ipAddress", "userAgent", "oldValues", "newValues",
            "changedFields", "sessionId", "requestId", "metadata"
        ) VALUES (
            'audit-' || extract(epoch from now())::text || '-' || floor(random() * 10000)::text,
            TG_TABLE_NAME, NEW.id::TEXT, 'CREATE',
            NULLIF(current_user_id, ''), NULLIF(current_user_email, ''),
            NULLIF(current_ip, ''), NULLIF(current_user_agent, ''),
            NULL, new_values,
            ARRAY[]::TEXT[], NULLIF(current_session_id, ''), NULLIF(current_request_id, ''),
            json_build_object(
                'operation', 'INSERT',
                'table_name', TG_TABLE_NAME,
                'sensitive_data', 'masked',
                'risk_level', 'HIGH'
            )
        );
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        old_values := to_json(OLD);
        new_values := to_json(NEW);
        changed_fields := audit_get_changed_fields(to_jsonb(OLD), to_jsonb(NEW));
        
        -- Mask sensitive data in both old and new values
        FOR field_name IN SELECT unnest(sensitive_fields) LOOP
            IF (old_values::JSONB) ? field_name AND ((old_values::JSONB)->>field_name) IS NOT NULL THEN
                old_values := jsonb_set(old_values::JSONB, ARRAY[field_name], '"[MASKED]"'::JSONB);
            END IF;
            IF (new_values::JSONB) ? field_name AND ((new_values::JSONB)->>field_name) IS NOT NULL THEN
                new_values := jsonb_set(new_values::JSONB, ARRAY[field_name], '"[MASKED]"'::JSONB);
            END IF;
        END LOOP;
        
        IF array_length(changed_fields, 1) > 0 THEN
            INSERT INTO audit_logs (
                "id", "tableName", "recordId", "action", "userId", "userEmail",
                "ipAddress", "userAgent", "oldValues", "newValues",
                "changedFields", "sessionId", "requestId", "metadata"
            ) VALUES (
                'audit-' || extract(epoch from now())::text || '-' || floor(random() * 10000)::text,
                TG_TABLE_NAME, NEW.id::TEXT, 'UPDATE',
                NULLIF(current_user_id, ''), NULLIF(current_user_email, ''),
                NULLIF(current_ip, ''), NULLIF(current_user_agent, ''),
                old_values, new_values,
                changed_fields, NULLIF(current_session_id, ''), NULLIF(current_request_id, ''),
                json_build_object(
                    'operation', 'UPDATE',
                    'table_name', TG_TABLE_NAME,
                    'changes_count', array_length(changed_fields, 1),
                    'sensitive_data', 'masked',
                    'risk_level', 'HIGH'
                )
            );
        END IF;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        old_values := to_json(OLD);
        
        -- Mask sensitive data in old_values
        FOR field_name IN SELECT unnest(sensitive_fields) LOOP
            IF (old_values::JSONB) ? field_name AND ((old_values::JSONB)->>field_name) IS NOT NULL THEN
                old_values := jsonb_set(old_values::JSONB, ARRAY[field_name], '"[MASKED]"'::JSONB);
            END IF;
        END LOOP;
        
        INSERT INTO audit_logs (
            "id", "tableName", "recordId", "action", "userId", "userEmail",
            "ipAddress", "userAgent", "oldValues", "newValues",
            "changedFields", "sessionId", "requestId", "metadata"
        ) VALUES (
            'audit-' || extract(epoch from now())::text || '-' || floor(random() * 10000)::text,
            TG_TABLE_NAME, OLD.id::TEXT, 'DELETE',
            NULLIF(current_user_id, ''), NULLIF(current_user_email, ''),
            NULLIF(current_ip, ''), NULLIF(current_user_agent, ''),
            old_values, NULL,
            ARRAY[]::TEXT[], NULLIF(current_session_id, ''), NULLIF(current_request_id, ''),
            json_build_object(
                'operation', 'DELETE',
                'table_name', TG_TABLE_NAME,
                'sensitive_data', 'masked',
                'risk_level', 'CRITICAL'
            )
        );
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- AUDIT UTILITY FUNCTIONS
-- =============================================

-- Function to set audit context (to be called by application)
CREATE OR REPLACE FUNCTION set_audit_context(
    p_user_id TEXT DEFAULT NULL,
    p_user_email TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Set session variables for audit context
    PERFORM set_config('audit.user_id', COALESCE(p_user_id, ''), false);
    PERFORM set_config('audit.user_email', COALESCE(p_user_email, ''), false);
    PERFORM set_config('audit.ip_address', COALESCE(p_ip_address, ''), false);
    PERFORM set_config('audit.user_agent', COALESCE(p_user_agent, ''), false);
    PERFORM set_config('audit.session_id', COALESCE(p_session_id, ''), false);
    PERFORM set_config('audit.request_id', COALESCE(p_request_id, ''), false);
END;
$$ LANGUAGE plpgsql;

-- Function to clear audit context
CREATE OR REPLACE FUNCTION clear_audit_context() 
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('audit.user_id', '', false);
    PERFORM set_config('audit.user_email', '', false);
    PERFORM set_config('audit.ip_address', '', false);
    PERFORM set_config('audit.user_agent', '', false);
    PERFORM set_config('audit.session_id', '', false);
    PERFORM set_config('audit.request_id', '', false);
END;
$$ LANGUAGE plpgsql;

-- Function to manually create audit log entries
CREATE OR REPLACE FUNCTION create_manual_audit_log(
    p_table_name TEXT,
    p_record_id TEXT,
    p_action TEXT,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_changed_fields TEXT[] DEFAULT ARRAY[]::TEXT[],
    p_metadata JSONB DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    current_user_id TEXT;
    current_user_email TEXT;
    current_ip TEXT;
    current_user_agent TEXT;
    current_session_id TEXT;
    current_request_id TEXT;
BEGIN
    -- Get current audit context
    current_user_id := current_setting('audit.user_id', true);
    current_user_email := current_setting('audit.user_email', true);
    current_ip := current_setting('audit.ip_address', true);
    current_user_agent := current_setting('audit.user_agent', true);
    current_session_id := current_setting('audit.session_id', true);
    current_request_id := current_setting('audit.request_id', true);
    
    INSERT INTO audit_logs (
        "id", "tableName", "recordId", "action", "userId", "userEmail",
        "ipAddress", "userAgent", "oldValues", "newValues",
        "changedFields", "sessionId", "requestId", "metadata"
    ) VALUES (
        'audit-' || extract(epoch from now())::text || '-' || floor(random() * 10000)::text,
        p_table_name, p_record_id, p_action,
        NULLIF(current_user_id, ''), NULLIF(current_user_email, ''),
        NULLIF(current_ip, ''), NULLIF(current_user_agent, ''),
        p_old_values, p_new_values,
        p_changed_fields, NULLIF(current_session_id, ''), NULLIF(current_request_id, ''),
        COALESCE(p_metadata, jsonb_build_object('manual_entry', true))
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get audit trail for a specific record
CREATE OR REPLACE FUNCTION get_audit_trail(
    p_table_name TEXT,
    p_record_id TEXT,
    p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
    id TEXT,
    action TEXT,
    user_email TEXT,
    changed_fields TEXT[],
    audit_timestamp TIMESTAMP,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.id,
        al.action,
        al."userEmail",
        al."changedFields",
        al.timestamp,
        al.metadata
    FROM audit_logs al
    WHERE al."tableName" = p_table_name
    AND al."recordId" = p_record_id
    ORDER BY al.timestamp DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Enhanced cleanup function for old audit logs with retention policies
CREATE OR REPLACE FUNCTION cleanup_audit_logs(
    retention_days INTEGER DEFAULT 90,
    critical_retention_days INTEGER DEFAULT 365,
    batch_size INTEGER DEFAULT 1000
) RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    total_deleted INTEGER := 0;
    cutoff_date TIMESTAMP;
    critical_cutoff_date TIMESTAMP;
BEGIN
    cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
    critical_cutoff_date := NOW() - (critical_retention_days || ' days')::INTERVAL;
    
    -- Log the cleanup operation start
    INSERT INTO audit_logs (
        "tableName", "recordId", "action", "userId", "userEmail",
        "ipAddress", "userAgent", "oldValues", "newValues",
        "changedFields", "sessionId", "requestId", "metadata"
    ) VALUES (
        'audit_logs', 'system', 'MAINTENANCE',
        'system', 'system@audit',
        NULL, 'audit-cleanup-function',
        NULL, NULL,
        ARRAY[]::TEXT[], NULL, NULL,
        json_build_object(
            'operation', 'cleanup_start',
            'retention_days', retention_days,
            'critical_retention_days', critical_retention_days,
            'cutoff_date', cutoff_date,
            'critical_cutoff_date', critical_cutoff_date
        )
    );
    
    -- Delete non-critical logs in batches
    LOOP
        DELETE FROM audit_logs 
        WHERE timestamp < cutoff_date
        AND "tableName" NOT IN ('users', 'payment_methods', 'orders')
        AND ctid IN (
            SELECT ctid FROM audit_logs
            WHERE timestamp < cutoff_date
            AND "tableName" NOT IN ('users', 'payment_methods', 'orders')
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        total_deleted := total_deleted + deleted_count;
        
        EXIT WHEN deleted_count = 0;
        
        -- Allow other operations to proceed
        PERFORM pg_sleep(0.1);
    END LOOP;
    
    -- Delete critical logs older than extended retention period
    LOOP
        DELETE FROM audit_logs 
        WHERE timestamp < critical_cutoff_date
        AND ctid IN (
            SELECT ctid FROM audit_logs
            WHERE timestamp < critical_cutoff_date
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        total_deleted := total_deleted + deleted_count;
        
        EXIT WHEN deleted_count = 0;
        
        -- Allow other operations to proceed
        PERFORM pg_sleep(0.1);
    END LOOP;
    
    -- Log the cleanup operation completion
    INSERT INTO audit_logs (
        "tableName", "recordId", "action", "userId", "userEmail",
        "ipAddress", "userAgent", "oldValues", "newValues",
        "changedFields", "sessionId", "requestId", "metadata"
    ) VALUES (
        'audit_logs', 'system', 'MAINTENANCE',
        'system', 'system@audit',
        NULL, 'audit-cleanup-function',
        NULL, NULL,
        ARRAY[]::TEXT[], NULL, NULL,
        json_build_object(
            'operation', 'cleanup_complete',
            'records_deleted', total_deleted,
            'retention_days', retention_days,
            'critical_retention_days', critical_retention_days
        )
    );
    
    RAISE NOTICE 'Cleaned up % audit log records', total_deleted;
    RETURN total_deleted;
END;
$$ LANGUAGE plpgsql;

-- Grant appropriate permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;
GRANT SELECT ON audit_logs TO readonly_user;

-- Log successful audit system creation
SELECT 'Audit system functions created successfully!' as status;