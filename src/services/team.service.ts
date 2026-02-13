/**
 * Team Service
 *
 * Handles team member management operations.
 */

import { query } from "@/lib/db";

export interface TeamMember {
  id: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: "owner" | "admin" | "member";
  joinedAt: string;
  lastLoginAt: string | null;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: string;
  invitedBy: string;
  invitedAt: string;
  status: "pending" | "accepted" | "expired";
}

/**
 * Get all team members for an organization
 */
export async function getTeamMembers(
  organizationId: string
): Promise<TeamMember[]> {
  const result = await query(
    `SELECT
      om.id,
      om.user_id,
      u.email,
      u.first_name,
      u.last_name,
      u.avatar_url,
      om.role,
      om.joined_at,
      u.last_login_at
    FROM organization_members om
    JOIN users u ON om.user_id = u.id
    WHERE om.organization_id = $1
    ORDER BY
      CASE om.role
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        ELSE 3
      END,
      om.joined_at ASC`,
    [organizationId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    joinedAt: row.joined_at,
    lastLoginAt: row.last_login_at,
  }));
}

/**
 * Get a single team member
 */
export async function getTeamMember(
  organizationId: string,
  memberId: string
): Promise<TeamMember | null> {
  const result = await query(
    `SELECT
      om.id,
      om.user_id,
      u.email,
      u.first_name,
      u.last_name,
      u.avatar_url,
      om.role,
      om.joined_at,
      u.last_login_at
    FROM organization_members om
    JOIN users u ON om.user_id = u.id
    WHERE om.organization_id = $1 AND om.id = $2`,
    [organizationId, memberId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    joinedAt: row.joined_at,
    lastLoginAt: row.last_login_at,
  };
}

/**
 * Update a team member's role
 */
export async function updateMemberRole(
  organizationId: string,
  memberId: string,
  role: "admin" | "member"
): Promise<boolean> {
  // Can't change owner role
  const result = await query(
    `UPDATE organization_members
    SET role = $1
    WHERE organization_id = $2 AND id = $3 AND role != 'owner'
    RETURNING id`,
    [role, organizationId, memberId]
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Remove a team member
 */
export async function removeMember(
  organizationId: string,
  memberId: string
): Promise<boolean> {
  // Can't remove owner
  const result = await query(
    `DELETE FROM organization_members
    WHERE organization_id = $1 AND id = $2 AND role != 'owner'
    RETURNING id`,
    [organizationId, memberId]
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Invite a new team member
 */
export async function inviteTeamMember(
  organizationId: string,
  email: string,
  role: "admin" | "member",
  invitedByUserId: string
): Promise<{ success: boolean; error?: string }> {
  // Check if user already exists
  const existingUser = await query(
    `SELECT id FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );

  if (existingUser.rows.length > 0) {
    const userId = existingUser.rows[0].id;

    // Check if already a member
    const existingMember = await query(
      `SELECT id FROM organization_members
      WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, userId]
    );

    if (existingMember.rows.length > 0) {
      return { success: false, error: "User is already a team member" };
    }

    // Add existing user to organization
    await query(
      `INSERT INTO organization_members (organization_id, user_id, role, invited_by, invited_at, joined_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [organizationId, userId, role, invitedByUserId]
    );

    return { success: true };
  }

  // For new users, we would typically send an invite email
  // For now, return an error indicating the user doesn't exist
  return {
    success: false,
    error: "User does not have an account. They must sign up first."
  };
}

/**
 * Get team statistics
 */
export async function getTeamStats(organizationId: string): Promise<{
  totalMembers: number;
  admins: number;
  members: number;
}> {
  const result = await query(
    `SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE role IN ('owner', 'admin')) as admins,
      COUNT(*) FILTER (WHERE role = 'member') as members
    FROM organization_members
    WHERE organization_id = $1`,
    [organizationId]
  );

  const row = result.rows[0];
  return {
    totalMembers: parseInt(row.total, 10),
    admins: parseInt(row.admins, 10),
    members: parseInt(row.members, 10),
  };
}

/**
 * Check if user is org admin/owner
 */
export async function isOrgAdmin(
  organizationId: string,
  userId: string
): Promise<boolean> {
  const result = await query(
    `SELECT role FROM organization_members
    WHERE organization_id = $1 AND user_id = $2 AND role IN ('owner', 'admin')`,
    [organizationId, userId]
  );

  return result.rows.length > 0;
}
