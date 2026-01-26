-- VoiceFlow Pro Database Schema
-- Version: 1.0.0
-- Created: January 26, 2025
--
-- Run this script to create all required tables:
-- psql -d voiceflow_pro -f sql/001_initial_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Organizations/Companies table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    industry VARCHAR(100),
    website VARCHAR(255),
    phone VARCHAR(50),
    timezone VARCHAR(100) DEFAULT 'America/New_York',
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Organization members (many-to-many with roles)
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- owner, admin, member
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMP,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);

-- Sessions for authentication
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ============================================
-- PHONE NUMBERS
-- ============================================

CREATE TABLE IF NOT EXISTS phone_numbers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    number VARCHAR(20) UNIQUE NOT NULL,
    country_code VARCHAR(5) DEFAULT 'US',
    provider VARCHAR(50) DEFAULT 'twilio', -- twilio, telnyx
    provider_id VARCHAR(100), -- Provider's unique identifier
    friendly_name VARCHAR(255),
    capabilities JSONB DEFAULT '{"voice": true, "sms": true}',
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, pending
    monthly_cost DECIMAL(10,2) DEFAULT 5.00,
    assigned_flow_id UUID, -- Will reference flows table
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_phone_numbers_org ON phone_numbers(organization_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_number ON phone_numbers(number);

-- ============================================
-- CONVERSATION FLOWS (Agent Canvas)
-- ============================================

CREATE TABLE IF NOT EXISTS flows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_type VARCHAR(100), -- home_services, real_estate, legal, healthcare, etc.
    status VARCHAR(50) DEFAULT 'draft', -- draft, published, archived
    version INTEGER DEFAULT 1,
    nodes JSONB DEFAULT '[]', -- Array of flow nodes
    edges JSONB DEFAULT '[]', -- Connections between nodes
    variables JSONB DEFAULT '{}', -- Flow variables
    settings JSONB DEFAULT '{}', -- Voice, personality, etc.
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_flows_org ON flows(organization_id);
CREATE INDEX IF NOT EXISTS idx_flows_status ON flows(status);

-- Flow versions for history
CREATE TABLE IF NOT EXISTS flow_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    nodes JSONB NOT NULL,
    edges JSONB NOT NULL,
    variables JSONB,
    settings JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(flow_id, version)
);

CREATE INDEX IF NOT EXISTS idx_flow_versions_flow ON flow_versions(flow_id);

-- ============================================
-- CALLS
-- ============================================

CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    flow_id UUID REFERENCES flows(id),
    phone_number_id UUID REFERENCES phone_numbers(id),

    -- Call details
    direction VARCHAR(20) NOT NULL, -- inbound, outbound
    caller_number VARCHAR(20) NOT NULL,
    callee_number VARCHAR(20) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'initiated', -- initiated, ringing, in_progress, completed, failed, missed

    -- Timing
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    answered_at TIMESTAMP,
    ended_at TIMESTAMP,
    duration_seconds INTEGER DEFAULT 0,

    -- AI Analysis
    primary_intent VARCHAR(100),
    intent_confidence DECIMAL(3,2),
    sentiment_score DECIMAL(3,2), -- -1 to 1
    sentiment_label VARCHAR(50), -- positive, neutral, negative

    -- Outcome
    outcome VARCHAR(100), -- resolved, transferred, voicemail, missed, etc.
    outcome_details TEXT,

    -- Recording & Transcript
    recording_url TEXT,
    recording_duration_seconds INTEGER,
    transcript TEXT,
    summary TEXT,

    -- Cost tracking
    cost_amount DECIMAL(10,4) DEFAULT 0,
    cost_currency VARCHAR(3) DEFAULT 'USD',

    -- Provider info
    provider VARCHAR(50) DEFAULT 'twilio',
    provider_call_id VARCHAR(100),

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calls_org ON calls(organization_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_started ON calls(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_number);
CREATE INDEX IF NOT EXISTS idx_calls_direction ON calls(direction);

-- Call events/logs (detailed conversation)
CREATE TABLE IF NOT EXISTS call_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- transcript, intent, action, error, transfer
    speaker VARCHAR(20), -- ai, caller, system
    content TEXT,
    intent VARCHAR(100),
    confidence DECIMAL(3,2),
    sentiment DECIMAL(3,2),
    duration_ms INTEGER,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_call_events_call ON call_events(call_id);
CREATE INDEX IF NOT EXISTS idx_call_events_type ON call_events(event_type);

-- ============================================
-- KNOWLEDGE BASE
-- ============================================

CREATE TABLE IF NOT EXISTS knowledge_base_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES knowledge_base_categories(id),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kb_categories_org ON knowledge_base_categories(organization_id);

CREATE TABLE IF NOT EXISTS knowledge_base_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES knowledge_base_categories(id),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    keywords TEXT[], -- Array of keywords for search
    priority INTEGER DEFAULT 0, -- Higher priority answers shown first
    is_active BOOLEAN DEFAULT TRUE,
    times_used INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kb_entries_org ON knowledge_base_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_kb_entries_category ON knowledge_base_entries(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_entries_keywords ON knowledge_base_entries USING GIN(keywords);

-- ============================================
-- INTEGRATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(100) NOT NULL, -- google_calendar, salesforce, hubspot, slack, etc.
    status VARCHAR(50) DEFAULT 'connected', -- connected, disconnected, error
    credentials JSONB, -- Encrypted OAuth tokens, API keys
    settings JSONB DEFAULT '{}', -- Provider-specific settings
    last_sync_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integrations_org ON integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);

-- ============================================
-- BILLING & SUBSCRIPTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan VARCHAR(50) NOT NULL DEFAULT 'starter', -- starter, professional, business, enterprise
    status VARCHAR(50) DEFAULT 'active', -- active, past_due, canceled, trialing

    -- Billing details
    stripe_customer_id VARCHAR(100),
    stripe_subscription_id VARCHAR(100),

    -- Plan limits
    minutes_included INTEGER DEFAULT 2000,
    minutes_used INTEGER DEFAULT 0,
    concurrent_calls_limit INTEGER DEFAULT 3,
    phone_numbers_limit INTEGER DEFAULT 2,

    -- Billing cycle
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    trial_ends_at TIMESTAMP,
    canceled_at TIMESTAMP,

    -- Pricing
    monthly_price DECIMAL(10,2),
    overage_rate DECIMAL(10,4), -- Per minute overage cost

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_customer_id);

-- Usage tracking
CREATE TABLE IF NOT EXISTS usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id),
    record_type VARCHAR(50) NOT NULL, -- minutes, sms, phone_number, etc.
    quantity DECIMAL(10,4) NOT NULL,
    unit_cost DECIMAL(10,4),
    total_cost DECIMAL(10,4),
    call_id UUID REFERENCES calls(id),
    description TEXT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usage_org ON usage_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_recorded ON usage_records(recorded_at);

-- ============================================
-- ANALYTICS (Aggregated)
-- ============================================

CREATE TABLE IF NOT EXISTS analytics_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Call metrics
    total_calls INTEGER DEFAULT 0,
    inbound_calls INTEGER DEFAULT 0,
    outbound_calls INTEGER DEFAULT 0,
    total_duration_seconds INTEGER DEFAULT 0,
    avg_duration_seconds DECIMAL(10,2) DEFAULT 0,

    -- Outcome metrics
    resolved_calls INTEGER DEFAULT 0,
    transferred_calls INTEGER DEFAULT 0,
    missed_calls INTEGER DEFAULT 0,

    -- Sentiment
    positive_calls INTEGER DEFAULT 0,
    neutral_calls INTEGER DEFAULT 0,
    negative_calls INTEGER DEFAULT 0,

    -- Revenue impact
    appointments_booked INTEGER DEFAULT 0,
    leads_captured INTEGER DEFAULT 0,
    estimated_revenue DECIMAL(10,2) DEFAULT 0,

    -- Cost
    total_cost DECIMAL(10,2) DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_org_date ON analytics_daily(organization_id, date DESC);

-- ============================================
-- OUTBOUND CAMPAIGNS
-- ============================================

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    flow_id UUID REFERENCES flows(id),
    status VARCHAR(50) DEFAULT 'draft', -- draft, scheduled, running, paused, completed

    -- Schedule
    scheduled_start TIMESTAMP,
    scheduled_end TIMESTAMP,
    allowed_hours_start TIME DEFAULT '09:00',
    allowed_hours_end TIME DEFAULT '17:00',
    allowed_days INTEGER[] DEFAULT '{1,2,3,4,5}', -- 0=Sun, 6=Sat
    timezone VARCHAR(100) DEFAULT 'America/New_York',

    -- Settings
    max_attempts INTEGER DEFAULT 3,
    retry_interval_hours INTEGER DEFAULT 24,
    concurrent_calls INTEGER DEFAULT 5,

    -- Stats
    total_contacts INTEGER DEFAULT 0,
    completed_contacts INTEGER DEFAULT 0,
    successful_contacts INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaigns_org ON campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- Campaign contacts
CREATE TABLE IF NOT EXISTS campaign_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    custom_data JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed, dnc
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP,
    call_id UUID REFERENCES calls(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign ON campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON campaign_contacts(status);

-- ============================================
-- AUDIT LOG
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- create, update, delete, login, etc.
    entity_type VARCHAR(100), -- user, flow, call, etc.
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_phone_numbers_updated_at BEFORE UPDATE ON phone_numbers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_flows_updated_at BEFORE UPDATE ON flows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON calls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kb_entries_updated_at BEFORE UPDATE ON knowledge_base_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- GRANT PERMISSIONS (if using specific DB user)
-- ============================================

-- Uncomment and modify if needed:
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO voiceflow_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO voiceflow_user;

-- ============================================
-- COMPLETION MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE 'VoiceFlow Pro database schema created successfully!';
    RAISE NOTICE 'Tables created: users, organizations, organization_members, sessions, phone_numbers, flows, flow_versions, calls, call_events, knowledge_base_categories, knowledge_base_entries, integrations, subscriptions, usage_records, analytics_daily, campaigns, campaign_contacts, audit_logs';
END $$;
