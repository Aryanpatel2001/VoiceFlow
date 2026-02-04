-- VoiceFlow Pro - Migration: Fix integrations.credentials type
-- Version: 1.0.2
-- Run: psql -d voiceflow_pro -f sql/003_fix_integrations_credentials_type.sql
--
-- Why:
-- credentials are stored as encrypted strings (iv:tag:ciphertext), so TEXT is
-- the correct column type. JSONB can reject raw encrypted strings.

ALTER TABLE integrations
  ALTER COLUMN credentials TYPE TEXT
  USING
    CASE
      WHEN credentials IS NULL THEN NULL
      ELSE trim(both '"' from credentials::text)
    END;

DO $$ BEGIN RAISE NOTICE 'Migration 003: integrations.credentials converted to TEXT'; END $$;
