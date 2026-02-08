-- Campaign Performance Indexes Migration
-- Version: 005
-- Created: 2025-02-08
--
-- Adds composite indexes to improve campaign contact query performance.
-- These indexes optimize the frequent queries that filter by campaign_id AND status.

-- Composite index for campaign_id + status queries
-- Used by: getNextContactsForDialing, checkCampaignCompletion, stats queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_contacts_campaign_status
ON campaign_contacts(campaign_id, status);

-- Composite index for retry logic queries (campaign_id + status + last_attempt_at)
-- Used by: getNextContactsForDialing with retry interval checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_contacts_campaign_status_attempt
ON campaign_contacts(campaign_id, status, last_attempt_at)
WHERE status = 'pending';

-- Index for campaign execution queries (campaign + status + attempts)
-- Optimizes the dialing candidate selection
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_contacts_dialing
ON campaign_contacts(campaign_id, created_at)
WHERE status = 'pending';

-- Add index on campaigns for status-based queries during execution
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_running_scheduled
ON campaigns(organization_id, status, scheduled_start, scheduled_end)
WHERE status IN ('running', 'scheduled');

-- Completion notice
DO $$
BEGIN
    RAISE NOTICE 'Campaign performance indexes created successfully!';
    RAISE NOTICE 'Indexes added: idx_campaign_contacts_campaign_status, idx_campaign_contacts_campaign_status_attempt, idx_campaign_contacts_dialing, idx_campaigns_running_scheduled';
END $$;
