-- =============================================
-- Migration: Add Contact Lists
-- Version: 1.0.9
-- Description: Creates contact_lists and contact_list_items tables
--              for reusable contact management
-- =============================================

-- Contact Lists - Reusable contact collections
CREATE TABLE IF NOT EXISTS contact_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    total_contacts INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for contact_lists
CREATE INDEX IF NOT EXISTS idx_contact_lists_org ON contact_lists(organization_id);
CREATE INDEX IF NOT EXISTS idx_contact_lists_created_at ON contact_lists(created_at DESC);

-- Contact List Items - Individual contacts in a list
CREATE TABLE IF NOT EXISTS contact_list_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    custom_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contact_list_id, phone_number)
);

-- Indexes for contact_list_items
CREATE INDEX IF NOT EXISTS idx_contact_list_items_list ON contact_list_items(contact_list_id);
CREATE INDEX IF NOT EXISTS idx_contact_list_items_phone ON contact_list_items(phone_number);

-- Trigger for updating updated_at on contact_lists
CREATE TRIGGER update_contact_lists_updated_at
    BEFORE UPDATE ON contact_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update total_contacts count
CREATE OR REPLACE FUNCTION update_contact_list_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE contact_lists
        SET total_contacts = total_contacts + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.contact_list_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE contact_lists
        SET total_contacts = total_contacts - 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.contact_list_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update contact count
CREATE TRIGGER update_contact_list_total
    AFTER INSERT OR DELETE ON contact_list_items
    FOR EACH ROW EXECUTE FUNCTION update_contact_list_count();
