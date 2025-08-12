-- PostgreSQL Utility Functions
-- NextJS Stripe Payment Template

\c payment_template_dev;

-- Function to safely update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate URL-safe slugs
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN lower(
        trim(
            regexp_replace(
                regexp_replace(input_text, '[^a-zA-Z0-9\s\-_]', '', 'g'),
                '\s+', '-', 'g'
            ), 
            '-'
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to generate unique order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    counter INTEGER := 0;
BEGIN
    LOOP
        new_number := 'ORD-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
                     LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
        
        -- Check if this number already exists (assuming orders table exists)
        -- This will be used after Prisma migration
        counter := counter + 1;
        
        -- Prevent infinite loop
        IF counter > 100 THEN
            new_number := new_number || '-' || EXTRACT(epoch FROM NOW())::INTEGER;
            EXIT;
        END IF;
        
        EXIT; -- For now, just exit since table doesn't exist yet
    END LOOP;
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate subscription next billing date
CREATE OR REPLACE FUNCTION calculate_next_billing_date(
    current_period_start TIMESTAMP,
    billing_interval TEXT,
    interval_count INTEGER DEFAULT 1
)
RETURNS TIMESTAMP AS $$
BEGIN
    CASE billing_interval
        WHEN 'day' THEN
            RETURN current_period_start + (interval_count || ' days')::INTERVAL;
        WHEN 'week' THEN
            RETURN current_period_start + (interval_count || ' weeks')::INTERVAL;
        WHEN 'month' THEN
            RETURN current_period_start + (interval_count || ' months')::INTERVAL;
        WHEN 'year' THEN
            RETURN current_period_start + (interval_count || ' years')::INTERVAL;
        ELSE
            RETURN current_period_start + '1 month'::INTERVAL;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate trial end date
CREATE OR REPLACE FUNCTION calculate_trial_end(
    start_date TIMESTAMP,
    trial_days INTEGER
)
RETURNS TIMESTAMP AS $$
BEGIN
    IF trial_days IS NULL OR trial_days <= 0 THEN
        RETURN start_date;
    END IF;
    
    RETURN start_date + (trial_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to validate email format
CREATE OR REPLACE FUNCTION is_valid_email(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to mask sensitive data for logging
CREATE OR REPLACE FUNCTION mask_sensitive_data(data_type TEXT, value TEXT)
RETURNS TEXT AS $$
BEGIN
    CASE data_type
        WHEN 'email' THEN
            RETURN SUBSTRING(value FROM 1 FOR 2) || '***@' || 
                   SUBSTRING(value FROM POSITION('@' IN value) + 1);
        WHEN 'phone' THEN
            RETURN '***-***-' || RIGHT(value, 4);
        WHEN 'card' THEN
            RETURN '****-****-****-' || RIGHT(value, 4);
        WHEN 'api_key' THEN
            RETURN LEFT(value, 8) || '...' || RIGHT(value, 4);
        ELSE
            RETURN '***MASKED***';
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to clean up old audit logs
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete audit logs older than specified days
    DELETE FROM audit_logs 
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup operation
    RAISE NOTICE 'Cleaned up % old audit log records', deleted_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate MRR (Monthly Recurring Revenue)
CREATE OR REPLACE FUNCTION calculate_mrr()
RETURNS DECIMAL AS $$
DECLARE
    mrr_amount DECIMAL := 0;
BEGIN
    -- This will be implemented after tables are created
    -- For now, return 0
    RETURN mrr_amount;
END;
$$ LANGUAGE plpgsql;

-- Function to get user subscription status
CREATE OR REPLACE FUNCTION get_user_subscription_status(user_id_param TEXT)
RETURNS TEXT AS $$
DECLARE
    subscription_status TEXT;
BEGIN
    -- This will be implemented after tables are created
    -- For now, return 'unknown'
    RETURN 'unknown';
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better function performance
CREATE INDEX IF NOT EXISTS idx_function_test ON pg_proc(proname) 
WHERE pronamespace = 'public'::regnamespace;

-- Grant execute permissions on functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO readonly_user;

-- Log functions creation completion
SELECT 'Database utility functions created successfully!' as status;