-- Phone Number Optimizations
-- Adds missing indexes and optimizations for phone number operations

-- Index on assigned_flow_id for reverse lookups (flow -> phone numbers)
CREATE INDEX IF NOT EXISTS idx_phone_numbers_assigned_flow
ON phone_numbers(assigned_flow_id)
WHERE assigned_flow_id IS NOT NULL;

-- Composite index for provider lookups (useful for Twilio operations)
CREATE INDEX IF NOT EXISTS idx_phone_numbers_provider_id
ON phone_numbers(provider, provider_id)
WHERE provider_id IS NOT NULL;

-- Index for status filtering within organization
CREATE INDEX IF NOT EXISTS idx_phone_numbers_org_status_active
ON phone_numbers(organization_id, status)
WHERE status = 'active';

-- Comment explaining the indexes
COMMENT ON INDEX idx_phone_numbers_assigned_flow IS 'Optimizes queries finding phone numbers by their assigned flow';
COMMENT ON INDEX idx_phone_numbers_provider_id IS 'Optimizes Twilio number lookups by provider_id';
COMMENT ON INDEX idx_phone_numbers_org_status_active IS 'Optimizes active number counts and listings per organization';
