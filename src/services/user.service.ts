/**
 * User Service
 *
 * Handles all user-related database operations.
 *
 * @module services/user
 * @see docs/features/02-authentication.md
 */

import { query, getClient } from "@/lib/db";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

// ============================================
// TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  email_verified: boolean;
  email_verified_at: Date | null;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserWithOrg extends User {
  organization_id: string | null;
  organization_name: string | null;
  organization_slug: string | null;
  role: string | null;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

// ============================================
// USER OPERATIONS
// ============================================

/**
 * Create a new user
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  const { email, password, firstName, lastName } = input;

  // Hash password
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);

  const result = await query<User>(
    `INSERT INTO users (email, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [email.toLowerCase(), passwordHash, firstName || null, lastName || null]
  );

  return result.rows[0];
}

/**
 * Find user by email
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await query<User>(
    `SELECT * FROM users WHERE email = $1 AND is_active = true`,
    [email.toLowerCase()]
  );

  return result.rows[0] || null;
}

/**
 * Find user by ID
 */
export async function findUserById(id: string): Promise<User | null> {
  const result = await query<User>(
    `SELECT * FROM users WHERE id = $1 AND is_active = true`,
    [id]
  );

  return result.rows[0] || null;
}

/**
 * Find user with organization details
 */
export async function findUserWithOrg(
  userId: string
): Promise<UserWithOrg | null> {
  const result = await query<UserWithOrg>(
    `SELECT
      u.*,
      o.id as organization_id,
      o.name as organization_name,
      o.slug as organization_slug,
      om.role
     FROM users u
     LEFT JOIN organization_members om ON om.user_id = u.id
     LEFT JOIN organizations o ON o.id = om.organization_id
     WHERE u.id = $1 AND u.is_active = true
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

/**
 * Verify user password
 */
export async function verifyPassword(
  user: User,
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, user.password_hash);
}

/**
 * Update user's last login timestamp
 */
export async function updateLastLogin(userId: string): Promise<void> {
  await query(`UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1`, [
    userId,
  ]);
}

/**
 * Update user profile
 */
export async function updateUser(
  userId: string,
  input: UpdateUserInput
): Promise<User> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (input.firstName !== undefined) {
    updates.push(`first_name = $${paramCount++}`);
    values.push(input.firstName);
  }

  if (input.lastName !== undefined) {
    updates.push(`last_name = $${paramCount++}`);
    values.push(input.lastName);
  }

  if (input.avatarUrl !== undefined) {
    updates.push(`avatar_url = $${paramCount++}`);
    values.push(input.avatarUrl);
  }

  if (updates.length === 0) {
    const user = await findUserById(userId);
    if (!user) throw new Error("User not found");
    return user;
  }

  values.push(userId);

  const result = await query<User>(
    `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  return result.rows[0];
}

/**
 * Change user password
 */
export async function changePassword(
  userId: string,
  newPassword: string
): Promise<void> {
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(newPassword, salt);

  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
    passwordHash,
    userId,
  ]);
}

/**
 * Verify user email
 */
export async function verifyEmail(userId: string): Promise<void> {
  await query(
    `UPDATE users SET email_verified = true, email_verified_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [userId]
  );
}

/**
 * Deactivate user account
 */
export async function deactivateUser(userId: string): Promise<void> {
  await query(`UPDATE users SET is_active = false WHERE id = $1`, [userId]);
}

/**
 * Check if email exists
 */
export async function emailExists(email: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

// ============================================
// ORGANIZATION OPERATIONS
// ============================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  timezone: string;
  logo_url: string | null;
  settings: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOrgInput {
  name: string;
  industry?: string;
  website?: string;
  phone?: string;
  timezone?: string;
}

/**
 * Create organization and add user as owner
 * Uses a manual transaction to get the org ID from the first insert
 */
export async function createOrganization(
  userId: string,
  input: CreateOrgInput
): Promise<Organization> {
  const slug = generateSlug(input.name);
  const client = await getClient();

  try {
    await client.query("BEGIN");

    // Create organization
    const orgResult = await client.query<Organization>(
      `INSERT INTO organizations (name, slug, industry, website, phone, timezone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.name,
        slug,
        input.industry || null,
        input.website || null,
        input.phone || null,
        input.timezone || "America/New_York",
      ]
    );

    const org = orgResult.rows[0];

    // Add user as owner
    await client.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [org.id, userId]
    );

    // Create starter subscription with 14-day trial
    await client.query(
      `INSERT INTO subscriptions (organization_id, plan, status, minutes_included, concurrent_calls_limit, phone_numbers_limit, trial_ends_at)
       VALUES ($1, 'starter', 'trialing', 2000, 3, 2, NOW() + INTERVAL '14 days')`,
      [org.id]
    );

    await client.query("COMMIT");
    return org;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Find organization by ID
 */
export async function findOrganizationById(
  id: string
): Promise<Organization | null> {
  const result = await query<Organization>(
    `SELECT * FROM organizations WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Find organization by slug
 */
export async function findOrganizationBySlug(
  slug: string
): Promise<Organization | null> {
  const result = await query<Organization>(
    `SELECT * FROM organizations WHERE slug = $1`,
    [slug]
  );
  return result.rows[0] || null;
}

/**
 * Get user's organizations
 */
export async function getUserOrganizations(
  userId: string
): Promise<(Organization & { role: string })[]> {
  const result = await query<Organization & { role: string }>(
    `SELECT o.*, om.role
     FROM organizations o
     JOIN organization_members om ON om.organization_id = o.id
     WHERE om.user_id = $1
     ORDER BY o.created_at DESC`,
    [userId]
  );
  return result.rows;
}

// ============================================
// SESSION OPERATIONS
// ============================================

export interface Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

/**
 * Create a new session
 */
export async function createSession(
  userId: string,
  token: string,
  expiresAt: Date,
  ipAddress?: string,
  userAgent?: string
): Promise<Session> {
  const result = await query<Session>(
    `INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, token, expiresAt, ipAddress || null, userAgent || null]
  );
  return result.rows[0];
}

/**
 * Find session by token
 */
export async function findSessionByToken(
  token: string
): Promise<Session | null> {
  const result = await query<Session>(
    `SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW()`,
    [token]
  );
  return result.rows[0] || null;
}

/**
 * Delete session
 */
export async function deleteSession(token: string): Promise<void> {
  await query(`DELETE FROM sessions WHERE token = $1`, [token]);
}

/**
 * Delete all user sessions
 */
export async function deleteUserSessions(userId: string): Promise<void> {
  await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}

/**
 * Clean expired sessions
 */
export async function cleanExpiredSessions(): Promise<number> {
  const result = await query(`DELETE FROM sessions WHERE expires_at < NOW()`);
  return result.rowCount || 0;
}

// ============================================
// HELPERS
// ============================================

/**
 * Generate URL-safe slug from name
 */
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Add random suffix to ensure uniqueness
  const suffix = uuidv4().slice(0, 8);
  return `${base}-${suffix}`;
}
