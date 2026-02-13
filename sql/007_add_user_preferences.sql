-- VoiceFlow Pro - Migration: Add User Notification Preferences
-- Version: 1.0.7
-- Run: psql -d voiceflow_pro -f sql/007_add_user_preferences.sql

-- Add notification preferences to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "emailNotifications": true,
  "callAlerts": true,
  "weeklyReport": true
}';

-- Add phone number to users for 2FA
ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

-- Add 2FA columns
ALTER TABLE users
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;

DO $$ BEGIN RAISE NOTICE 'Migration 007: User preferences columns added successfully!'; END $$;
