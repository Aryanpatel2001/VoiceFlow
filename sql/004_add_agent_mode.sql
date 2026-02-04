-- VoiceFlow Pro - Migration: Add flow agent mode
-- Version: 1.0.3
-- Run: psql -d voiceflow_pro -f sql/004_add_agent_mode.sql

ALTER TABLE flows
  ADD COLUMN IF NOT EXISTS agent_mode VARCHAR(20);

UPDATE flows
SET agent_mode = 'canvas'
WHERE agent_mode IS NULL;

ALTER TABLE flows
  ALTER COLUMN agent_mode SET DEFAULT 'canvas';

ALTER TABLE flows
  ALTER COLUMN agent_mode SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_flows_agent_mode'
  ) THEN
    ALTER TABLE flows
      ADD CONSTRAINT chk_flows_agent_mode
      CHECK (agent_mode IN ('canvas', 'single_prompt'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_flows_agent_mode ON flows(agent_mode);

DO $$ BEGIN RAISE NOTICE 'Migration 004: flows.agent_mode added successfully'; END $$;
