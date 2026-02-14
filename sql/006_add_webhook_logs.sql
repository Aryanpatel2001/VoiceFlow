-- VoiceFlow Pro - Migration: Add Webhook Logs Table
-- Version: 1.0.6
-- Run: psql -d voiceflow_pro -f sql/006_add_webhook_logs.sql

-- Webhook logs table for tracking all webhook requests
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    flow_id UUID REFERENCES flows(id) ON DELETE SET NULL,
    webhook_id VARCHAR(32) NOT NULL,

    -- Request details
    method VARCHAR(10) NOT NULL,
    path TEXT NOT NULL,

    -- Response details
    status_code INTEGER NOT NULL,
    request_headers JSONB DEFAULT '{}',
    request_body JSONB,
    response_body JSONB,
    response_time_ms INTEGER NOT NULL DEFAULT 0,

    -- Error tracking
    error TEXT,

    -- Client info
    ip_address INET,
    user_agent TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_webhook_logs_org_id ON webhook_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status_code ON webhook_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_flow_id ON webhook_logs(flow_id);

-- Composite index for filtered queries
CREATE INDEX IF NOT EXISTS idx_webhook_logs_org_created
    ON webhook_logs(organization_id, created_at DESC);

-- Auto-cleanup old logs (optional - can be run via cron)
-- Keeps logs for 30 days by default
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM webhook_logs
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN RAISE NOTICE 'Migration 006: Webhook logs table added successfully!'; END $$;
