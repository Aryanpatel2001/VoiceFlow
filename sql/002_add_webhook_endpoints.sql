-- VoiceFlow Pro - Migration: Add Webhook Endpoints
-- Version: 1.0.1
-- Run: psql -d voiceflow_pro -f sql/002_add_webhook_endpoints.sql

-- Add webhook_id for published flows (unique API endpoint identifier)
ALTER TABLE flows ADD COLUMN IF NOT EXISTS webhook_id VARCHAR(32) UNIQUE;

-- Create index for fast webhook lookups
CREATE INDEX IF NOT EXISTS idx_flows_webhook_id ON flows(webhook_id);

-- Add webhook_secret for validating incoming requests
ALTER TABLE flows ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(64);

-- Add deployed_version to track which version is currently live
ALTER TABLE flows ADD COLUMN IF NOT EXISTS deployed_version INTEGER;

-- Add endpoint_enabled flag to control if webhook is active
ALTER TABLE flows ADD COLUMN IF NOT EXISTS endpoint_enabled BOOLEAN DEFAULT FALSE;

-- Update phone_numbers to add foreign key constraint (if not exists)
-- This ensures assigned_flow_id points to valid flows
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_phone_numbers_flow'
    ) THEN
        ALTER TABLE phone_numbers
        ADD CONSTRAINT fk_phone_numbers_flow
        FOREIGN KEY (assigned_flow_id)
        REFERENCES flows(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Function to generate webhook ID
CREATE OR REPLACE FUNCTION generate_webhook_id()
RETURNS VARCHAR(32) AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
    result VARCHAR(32) := '';
    i INTEGER;
BEGIN
    FOR i IN 1..24 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-generate webhook_id when flow is first published
CREATE OR REPLACE FUNCTION set_webhook_id_on_publish()
RETURNS TRIGGER AS $$
BEGIN
    -- When status changes to 'published' and webhook_id is null, generate one
    IF NEW.status = 'published' AND OLD.status != 'published' AND NEW.webhook_id IS NULL THEN
        NEW.webhook_id := generate_webhook_id();
        NEW.webhook_secret := encode(gen_random_bytes(32), 'hex');
        NEW.endpoint_enabled := TRUE;
        NEW.deployed_version := NEW.version;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_webhook_id ON flows;
CREATE TRIGGER trigger_set_webhook_id
    BEFORE UPDATE ON flows
    FOR EACH ROW
    EXECUTE FUNCTION set_webhook_id_on_publish();

DO $$ BEGIN RAISE NOTICE 'Migration 002: Webhook endpoints added successfully!'; END $$;
