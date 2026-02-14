/**
 * GDPR Compliance API
 *
 * Endpoints for GDPR data subject rights:
 * - GET /api/gdpr - Export all user data
 * - DELETE /api/gdpr - Delete all user data
 *
 * These endpoints allow users to exercise their GDPR rights:
 * - Right to access (data export)
 * - Right to erasure (data deletion)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import { query, getClient } from "@/lib/db";
import { createAuditLog } from "@/services/audit.service";
import { getRequestMetadata } from "@/lib/request-meta";

/**
 * GET /api/gdpr - Export user data (Right to Access)
 * Returns all data associated with the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Strict rate limiting for data export
    const rateLimitResponse = applyRateLimit(request, "write", "gdpr/export");
    if (rateLimitResponse) return rateLimitResponse;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Collect all user data
    const userData = await collectUserData(user.id, user.organizationId);

    // Log the export request
    const meta = getRequestMetadata(request);
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "gdpr_data_export",
      entityType: "user",
      entityId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({
      exportDate: new Date().toISOString(),
      userId: user.id,
      data: userData,
    });
  } catch (error) {
    console.error("GDPR export error:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/gdpr - Delete user data (Right to Erasure)
 * Permanently deletes all data associated with the authenticated user
 */
export async function DELETE(request: NextRequest) {
  try {
    // Strict rate limiting for data deletion
    const rateLimitResponse = applyRateLimit(request, "write", "gdpr/delete");
    if (rateLimitResponse) return rateLimitResponse;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify deletion request with confirmation
    const body = await request.json().catch(() => ({}));
    if (body.confirm !== "DELETE_MY_DATA") {
      return NextResponse.json(
        {
          error: "Confirmation required",
          message: "Send { \"confirm\": \"DELETE_MY_DATA\" } to proceed",
        },
        { status: 400 }
      );
    }

    // Log the deletion request BEFORE deleting
    const meta = getRequestMetadata(request);
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "gdpr_data_deletion_requested",
      entityType: "user",
      entityId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    // Perform data deletion
    const deletionResult = await deleteUserData(user.id, user.organizationId);

    return NextResponse.json({
      success: true,
      deletionDate: new Date().toISOString(),
      deletedItems: deletionResult,
      message: "Your data has been permanently deleted",
    });
  } catch (error) {
    console.error("GDPR deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete data" },
      { status: 500 }
    );
  }
}

/**
 * Collect all user data for export
 */
async function collectUserData(
  userId: string,
  organizationId: string | null
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};

  // User profile
  const userResult = await query(
    `SELECT id, email, name, created_at, notification_preferences
     FROM users WHERE id = $1`,
    [userId]
  );
  data.profile = userResult.rows[0] || null;

  // User sessions (anonymized)
  const sessionsResult = await query(
    `SELECT COUNT(*) as session_count FROM sessions WHERE user_id = $1`,
    [userId]
  );
  data.sessions = { count: parseInt(sessionsResult.rows[0]?.session_count || "0", 10) };

  // If user belongs to an organization, include org-scoped data
  if (organizationId) {
    // User's team membership
    const teamResult = await query(
      `SELECT role, joined_at FROM organization_members
       WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, userId]
    );
    data.teamMembership = teamResult.rows[0] || null;

    // User's activity (audit logs)
    const auditResult = await query(
      `SELECT action, entity_type, created_at
       FROM audit_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );
    data.activityLog = auditResult.rows;

    // Calls made by user
    const callsResult = await query(
      `SELECT id, direction, caller_number, callee_number, status, started_at, duration_seconds
       FROM calls
       WHERE organization_id = $1 AND metadata->>'userId' = $2
       ORDER BY started_at DESC`,
      [organizationId, userId]
    );
    data.calls = callsResult.rows;
  }

  return data;
}

/**
 * Delete all user data
 */
async function deleteUserData(
  userId: string,
  organizationId: string | null
): Promise<Record<string, number>> {
  const client = await getClient();
  const deletedItems: Record<string, number> = {};

  try {
    await client.query("BEGIN");

    // Delete user sessions
    const sessionsResult = await client.query(
      `DELETE FROM sessions WHERE user_id = $1`,
      [userId]
    );
    deletedItems.sessions = sessionsResult.rowCount ?? 0;

    // Delete user accounts (OAuth linked accounts)
    const accountsResult = await client.query(
      `DELETE FROM accounts WHERE user_id = $1`,
      [userId]
    );
    deletedItems.accounts = accountsResult.rowCount ?? 0;

    // Anonymize audit logs (keep for compliance, but remove PII)
    const auditResult = await client.query(
      `UPDATE audit_logs SET user_id = NULL, ip_address = NULL, user_agent = NULL
       WHERE user_id = $1`,
      [userId]
    );
    deletedItems.auditLogsAnonymized = auditResult.rowCount ?? 0;

    // If user is in an organization
    if (organizationId) {
      // Remove from organization
      const memberResult = await client.query(
        `DELETE FROM organization_members
         WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, userId]
      );
      deletedItems.organizationMembership = memberResult.rowCount ?? 0;

      // Anonymize calls metadata
      await client.query(
        `UPDATE calls SET metadata = metadata - 'userId'
         WHERE organization_id = $1 AND metadata->>'userId' = $2`,
        [organizationId, userId]
      );
    }

    // Delete the user record last
    const userResult = await client.query(
      `DELETE FROM users WHERE id = $1`,
      [userId]
    );
    deletedItems.user = userResult.rowCount ?? 0;

    await client.query("COMMIT");
    return deletedItems;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
