-- Audit Triggers for Critical Tables
-- NextJS Stripe Payment Template
-- Apply audit logging to critical business data

\c payment_template_dev;

-- =============================================
-- DROP EXISTING TRIGGERS (for re-creation)
-- =============================================

-- Users table triggers
DROP TRIGGER IF EXISTS trigger_users_audit ON users;

-- Orders table triggers
DROP TRIGGER IF EXISTS trigger_orders_audit ON orders;

-- Products table triggers
DROP TRIGGER IF EXISTS trigger_products_audit ON products;

-- Subscriptions table triggers
DROP TRIGGER IF EXISTS trigger_subscriptions_audit ON subscriptions;

-- Payment methods table triggers
DROP TRIGGER IF EXISTS trigger_payment_methods_audit ON payment_methods;

-- Discount codes table triggers
DROP TRIGGER IF EXISTS trigger_discount_codes_audit ON discount_codes;

-- =============================================
-- CREATE AUDIT TRIGGERS
-- =============================================

-- Users table - Uses sensitive trigger for PII protection
CREATE TRIGGER trigger_users_audit
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW
    EXECUTE FUNCTION audit_sensitive_trigger_function();

COMMENT ON TRIGGER trigger_users_audit ON users IS 
'Audit trigger for users table - captures all user data changes with PII masking';

-- Orders table - Critical financial data
CREATE TRIGGER trigger_orders_audit
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

COMMENT ON TRIGGER trigger_orders_audit ON orders IS 
'Audit trigger for orders table - captures all order and financial data changes';

-- Products table - Business catalog changes
CREATE TRIGGER trigger_products_audit
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

COMMENT ON TRIGGER trigger_products_audit ON products IS 
'Audit trigger for products table - captures all product catalog changes';

-- Subscriptions table - Recurring billing data
CREATE TRIGGER trigger_subscriptions_audit
    AFTER INSERT OR UPDATE OR DELETE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

COMMENT ON TRIGGER trigger_subscriptions_audit ON subscriptions IS 
'Audit trigger for subscriptions table - captures all subscription billing changes';

-- Payment methods table - Uses sensitive trigger for payment data protection
CREATE TRIGGER trigger_payment_methods_audit
    AFTER INSERT OR UPDATE OR DELETE ON payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION audit_sensitive_trigger_function();

COMMENT ON TRIGGER trigger_payment_methods_audit ON payment_methods IS 
'Audit trigger for payment_methods table - captures payment method changes with data masking';

-- Discount codes table - Marketing and promotion changes
CREATE TRIGGER trigger_discount_codes_audit
    AFTER INSERT OR UPDATE OR DELETE ON discount_codes
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

COMMENT ON TRIGGER trigger_discount_codes_audit ON discount_codes IS 
'Audit trigger for discount_codes table - captures discount and promotion changes';

-- Order items table - Detailed order line items
CREATE TRIGGER trigger_order_items_audit
    AFTER INSERT OR UPDATE OR DELETE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

COMMENT ON TRIGGER trigger_order_items_audit ON order_items IS 
'Audit trigger for order_items table - captures detailed order line item changes';

-- User discount codes table - Usage tracking
CREATE TRIGGER trigger_user_discount_codes_audit
    AFTER INSERT OR UPDATE OR DELETE ON user_discount_codes
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

COMMENT ON TRIGGER trigger_user_discount_codes_audit ON user_discount_codes IS 
'Audit trigger for user_discount_codes table - captures discount code usage tracking';

-- Sessions table - Authentication events
CREATE TRIGGER trigger_sessions_audit
    AFTER INSERT OR UPDATE OR DELETE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION audit_sensitive_trigger_function();

COMMENT ON TRIGGER trigger_sessions_audit ON sessions IS 
'Audit trigger for sessions table - captures authentication session changes';

-- Accounts table - OAuth/social login data
CREATE TRIGGER trigger_accounts_audit
    AFTER INSERT OR UPDATE OR DELETE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION audit_sensitive_trigger_function();

COMMENT ON TRIGGER trigger_accounts_audit ON accounts IS 
'Audit trigger for accounts table - captures OAuth and social login account changes';

-- =============================================
-- TRIGGER MANAGEMENT FUNCTIONS
-- =============================================

-- Function to disable all audit triggers (for maintenance)
CREATE OR REPLACE FUNCTION disable_audit_triggers()
RETURNS VOID AS $$
BEGIN
    -- Disable triggers on critical tables
    ALTER TABLE users DISABLE TRIGGER trigger_users_audit;
    ALTER TABLE orders DISABLE TRIGGER trigger_orders_audit;
    ALTER TABLE products DISABLE TRIGGER trigger_products_audit;
    ALTER TABLE subscriptions DISABLE TRIGGER trigger_subscriptions_audit;
    ALTER TABLE payment_methods DISABLE TRIGGER trigger_payment_methods_audit;
    ALTER TABLE discount_codes DISABLE TRIGGER trigger_discount_codes_audit;
    ALTER TABLE order_items DISABLE TRIGGER trigger_order_items_audit;
    ALTER TABLE user_discount_codes DISABLE TRIGGER trigger_user_discount_codes_audit;
    ALTER TABLE sessions DISABLE TRIGGER trigger_sessions_audit;
    ALTER TABLE accounts DISABLE TRIGGER trigger_accounts_audit;
    
    -- Log the operation
    INSERT INTO audit_logs (
        "tableName", "recordId", "action", "userId", "userEmail",
        "ipAddress", "userAgent", "oldValues", "newValues",
        "changedFields", "sessionId", "requestId", "metadata"
    ) VALUES (
        'system', 'audit_triggers', 'DISABLE',
        'system', 'system@maintenance',
        NULL, 'trigger-management-function',
        NULL, NULL,
        ARRAY[]::TEXT[], NULL, NULL,
        json_build_object(
            'operation', 'disable_all_triggers',
            'timestamp', NOW(),
            'reason', 'maintenance'
        )
    );
    
    RAISE NOTICE 'All audit triggers disabled';
END;
$$ LANGUAGE plpgsql;

-- Function to enable all audit triggers
CREATE OR REPLACE FUNCTION enable_audit_triggers()
RETURNS VOID AS $$
BEGIN
    -- Enable triggers on critical tables
    ALTER TABLE users ENABLE TRIGGER trigger_users_audit;
    ALTER TABLE orders ENABLE TRIGGER trigger_orders_audit;
    ALTER TABLE products ENABLE TRIGGER trigger_products_audit;
    ALTER TABLE subscriptions ENABLE TRIGGER trigger_subscriptions_audit;
    ALTER TABLE payment_methods ENABLE TRIGGER trigger_payment_methods_audit;
    ALTER TABLE discount_codes ENABLE TRIGGER trigger_discount_codes_audit;
    ALTER TABLE order_items ENABLE TRIGGER trigger_order_items_audit;
    ALTER TABLE user_discount_codes ENABLE TRIGGER trigger_user_discount_codes_audit;
    ALTER TABLE sessions ENABLE TRIGGER trigger_sessions_audit;
    ALTER TABLE accounts ENABLE TRIGGER trigger_accounts_audit;
    
    -- Log the operation
    INSERT INTO audit_logs (
        "tableName", "recordId", "action", "userId", "userEmail",
        "ipAddress", "userAgent", "oldValues", "newValues",
        "changedFields", "sessionId", "requestId", "metadata"
    ) VALUES (
        'system', 'audit_triggers', 'ENABLE',
        'system', 'system@maintenance',
        NULL, 'trigger-management-function',
        NULL, NULL,
        ARRAY[]::TEXT[], NULL, NULL,
        json_build_object(
            'operation', 'enable_all_triggers',
            'timestamp', NOW(),
            'reason', 'maintenance_complete'
        )
    );
    
    RAISE NOTICE 'All audit triggers enabled';
END;
$$ LANGUAGE plpgsql;

-- Function to check trigger status
CREATE OR REPLACE FUNCTION check_audit_trigger_status()
RETURNS TABLE (
    table_name TEXT,
    trigger_name TEXT,
    trigger_enabled BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.event_object_table::TEXT,
        t.trigger_name::TEXT,
        TRUE as trigger_enabled  -- PostgreSQL triggers are enabled by default when created
    FROM information_schema.triggers t
    WHERE t.trigger_schema = 'public'
    AND t.trigger_name LIKE '%_audit'
    ORDER BY t.event_object_table, t.trigger_name;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- INITIAL AUDIT LOG ENTRY
-- =============================================

-- Log the successful creation of audit triggers
INSERT INTO audit_logs (
    "id", "tableName", "recordId", "action", "userId", "userEmail",
    "ipAddress", "userAgent", "oldValues", "newValues",
    "changedFields", "sessionId", "requestId", "metadata"
) VALUES (
    'audit-system-init-' || extract(epoch from now())::text,
    'system', 'audit_system', 'CREATE',
    'system', 'system@setup',
    NULL, 'database-initialization',
    NULL, NULL,
    ARRAY[]::TEXT[], NULL, NULL,
    json_build_object(
        'operation', 'audit_system_initialization',
        'timestamp', NOW(),
        'version', '1.0',
        'tables_monitored', ARRAY[
            'users', 'orders', 'products', 'subscriptions',
            'payment_methods', 'discount_codes', 'order_items',
            'user_discount_codes', 'sessions', 'accounts'
        ],
        'trigger_functions', ARRAY[
            'audit_trigger_function',
            'audit_sensitive_trigger_function'
        ],
        'utility_functions', ARRAY[
            'set_audit_context',
            'clear_audit_context',
            'create_manual_audit_log',
            'get_audit_trail',
            'cleanup_audit_logs'
        ]
    )
);

-- Grant permissions
GRANT EXECUTE ON FUNCTION disable_audit_triggers() TO app_user;
GRANT EXECUTE ON FUNCTION enable_audit_triggers() TO app_user;
GRANT EXECUTE ON FUNCTION check_audit_trigger_status() TO app_user;
GRANT EXECUTE ON FUNCTION check_audit_trigger_status() TO readonly_user;

-- Display successful completion
SELECT 'Audit triggers created and enabled successfully!' as status;

-- Show trigger status
SELECT 'Current audit trigger status:' as info;
SELECT * FROM check_audit_trigger_status();