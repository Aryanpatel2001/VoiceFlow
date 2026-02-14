-- Additional Performance Indexes Migration
-- Version: 008
-- Created: 2025-02-12
--
-- Adds additional indexes to improve query performance across the application.

-- ============================================
-- CALLS TABLE INDEXES
-- ============================================

-- Index for organization + status queries (analytics dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calls_org_status
ON calls(organization_id, status);

-- Index for organization + started_at (time-based queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calls_org_started
ON calls(organization_id, started_at DESC);

-- Index for flow_id queries (call history per flow)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calls_flow
ON calls(flow_id)
WHERE flow_id IS NOT NULL;

-- Index for phone number search (both caller and callee)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calls_caller_number
ON calls(caller_number);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calls_callee_number
ON calls(callee_number);

-- Index for provider call ID lookups (Twilio callback handling)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calls_provider_call_id
ON calls(provider_call_id)
WHERE provider_call_id IS NOT NULL;

-- ============================================
-- FLOWS TABLE INDEXES
-- ============================================

-- Index for organization + status queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_flows_org_status
ON flows(organization_id, status);

-- Index for webhook ID lookups (webhook handler)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_flows_webhook_id
ON flows(webhook_id)
WHERE webhook_id IS NOT NULL;

-- ============================================
-- PHONE_NUMBERS TABLE INDEXES
-- ============================================

-- Index for number lookups (inbound call routing)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_phone_numbers_number
ON phone_numbers(number);

-- Index for organization + status queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_phone_numbers_org_status
ON phone_numbers(organization_id, status);

-- ============================================
-- AUDIT_LOGS TABLE INDEXES
-- ============================================

-- Index for organization + created_at (log viewing)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_org_created
ON audit_logs(organization_id, created_at DESC);

-- Index for user_id queries (user activity)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user
ON audit_logs(user_id)
WHERE user_id IS NOT NULL;

-- Index for action type queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action
ON audit_logs(action);

-- ============================================
-- WEBHOOK_LOGS TABLE INDEXES
-- ============================================

-- Index for flow_id + created_at (webhook log viewing)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_logs_flow_created
ON webhook_logs(flow_id, created_at DESC);

-- Index for status code queries (error analysis)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_logs_status
ON webhook_logs(status_code)
WHERE status_code >= 400;

-- ============================================
-- INTEGRATIONS TABLE INDEXES
-- ============================================

-- Index for organization + type queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrations_org_type
ON integrations(organization_id, type);

-- Index for status queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrations_status
ON integrations(status);

-- ============================================
-- SESSIONS TABLE INDEXES (if exists)
-- ============================================

-- Index for session expiry cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expires
ON sessions(expires);

-- Index for user sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user
ON sessions(user_id);

-- ============================================
-- USERS TABLE INDEXES
-- ============================================

-- Index for organization membership
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_org
ON users(organization_id)
WHERE organization_id IS NOT NULL;

-- Completion notice
DO $$
BEGIN
    RAISE NOTICE 'Additional performance indexes created successfully!';
    RAISE NOTICE 'Tables with new indexes:';
    RAISE NOTICE '  - calls (6 indexes)';
    RAISE NOTICE '  - flows (2 indexes)';
    RAISE NOTICE '  - phone_numbers (2 indexes)';
    RAISE NOTICE '  - audit_logs (3 indexes)';
    RAISE NOTICE '  - webhook_logs (2 indexes)';
    RAISE NOTICE '  - integrations (2 indexes)';
    RAISE NOTICE '  - sessions (2 indexes)';
    RAISE NOTICE '  - users (1 index)';
END $$;
