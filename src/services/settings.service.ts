/**
 * Settings Service
 *
 * Handles user and organization settings operations.
 */

import { query } from "@/lib/db";

// ============================================
// Types
// ============================================

export interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

export interface UserProfileUpdate {
  firstName?: string;
  lastName?: string;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  callAlerts: boolean;
  weeklyReport: boolean;
}

export interface OrganizationSettings {
  id: string;
  name: string;
  industry: string | null;
  timezone: string;
  website: string | null;
  phone: string | null;
  logoUrl: string | null;
}

export interface OrganizationSettingsUpdate {
  name?: string;
  industry?: string;
  timezone?: string;
  website?: string;
  phone?: string;
}

// ============================================
// User Profile
// ============================================

/**
 * Get user profile by ID
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const result = await query<{
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  }>(
    `SELECT id, email, first_name, last_name, avatar_url
     FROM users WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarUrl: row.avatar_url,
  };
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: UserProfileUpdate
): Promise<boolean> {
  const setParts: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (updates.firstName !== undefined) {
    setParts.push(`first_name = $${paramIndex++}`);
    params.push(updates.firstName);
  }

  if (updates.lastName !== undefined) {
    setParts.push(`last_name = $${paramIndex++}`);
    params.push(updates.lastName);
  }

  if (setParts.length === 0) return false;

  params.push(userId);

  const result = await query(
    `UPDATE users SET ${setParts.join(", ")} WHERE id = $${paramIndex}`,
    params
  );

  return (result.rowCount ?? 0) > 0;
}

// ============================================
// Notification Preferences
// ============================================

/**
 * Get user notification preferences
 */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  const result = await query<{
    notification_preferences: NotificationPreferences | null;
  }>(
    `SELECT notification_preferences FROM users WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0 || !result.rows[0].notification_preferences) {
    return {
      emailNotifications: true,
      callAlerts: true,
      weeklyReport: true,
    };
  }

  return result.rows[0].notification_preferences;
}

/**
 * Update user notification preferences
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<boolean> {
  // Get current preferences
  const current = await getNotificationPreferences(userId);

  // Merge with updates
  const updated = {
    ...current,
    ...preferences,
  };

  const result = await query(
    `UPDATE users SET notification_preferences = $1 WHERE id = $2`,
    [JSON.stringify(updated), userId]
  );

  return (result.rowCount ?? 0) > 0;
}

// ============================================
// Organization Settings
// ============================================

/**
 * Get organization settings
 */
export async function getOrganizationSettings(
  organizationId: string
): Promise<OrganizationSettings | null> {
  const result = await query<{
    id: string;
    name: string;
    industry: string | null;
    timezone: string;
    website: string | null;
    phone: string | null;
    logo_url: string | null;
  }>(
    `SELECT id, name, industry, timezone, website, phone, logo_url
     FROM organizations WHERE id = $1`,
    [organizationId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    industry: row.industry,
    timezone: row.timezone,
    website: row.website,
    phone: row.phone,
    logoUrl: row.logo_url,
  };
}

/**
 * Update organization settings
 */
export async function updateOrganizationSettings(
  organizationId: string,
  updates: OrganizationSettingsUpdate
): Promise<boolean> {
  const setParts: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setParts.push(`name = $${paramIndex++}`);
    params.push(updates.name);
  }

  if (updates.industry !== undefined) {
    setParts.push(`industry = $${paramIndex++}`);
    params.push(updates.industry);
  }

  if (updates.timezone !== undefined) {
    setParts.push(`timezone = $${paramIndex++}`);
    params.push(updates.timezone);
  }

  if (updates.website !== undefined) {
    setParts.push(`website = $${paramIndex++}`);
    params.push(updates.website);
  }

  if (updates.phone !== undefined) {
    setParts.push(`phone = $${paramIndex++}`);
    params.push(updates.phone);
  }

  if (setParts.length === 0) return false;

  params.push(organizationId);

  const result = await query(
    `UPDATE organizations SET ${setParts.join(", ")} WHERE id = $${paramIndex}`,
    params
  );

  return (result.rowCount ?? 0) > 0;
}
