/**
 * Session Cleanup Utility
 *
 * Removes expired sessions from the database to maintain security
 * and reduce database bloat.
 *
 * Can be run:
 * - As a cron job: npx tsx src/lib/security/session-cleanup.ts
 * - Via API endpoint: POST /api/admin/cleanup-sessions
 * - On application startup
 */

import { query } from "@/lib/db";

interface CleanupResult {
  sessionsDeleted: number;
  auditLogsDeleted: number;
  timestamp: Date;
}

/**
 * Delete expired sessions from the database
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await query(
    `DELETE FROM sessions WHERE expires_at < NOW() RETURNING id`
  );
  return result.rowCount ?? 0;
}

/**
 * Delete old audit logs (older than retention period)
 * Default retention: 90 days
 */
export async function cleanupOldAuditLogs(
  retentionDays: number = 90
): Promise<number> {
  const result = await query(
    `DELETE FROM audit_logs
     WHERE created_at < NOW() - INTERVAL '${retentionDays} days'
     AND action NOT IN ('delete_account', 'security_breach')
     RETURNING id`
  );
  return result.rowCount ?? 0;
}

/**
 * Delete old failed login attempts from audit logs
 * Keep only last 30 days of failed login records
 */
export async function cleanupOldLoginAttempts(): Promise<number> {
  const result = await query(
    `DELETE FROM audit_logs
     WHERE action = 'failed_login'
     AND created_at < NOW() - INTERVAL '30 days'
     RETURNING id`
  );
  return result.rowCount ?? 0;
}

/**
 * Run full cleanup routine
 */
export async function runFullCleanup(): Promise<CleanupResult> {
  const sessionsDeleted = await cleanupExpiredSessions();
  const auditLogsDeleted = await cleanupOldAuditLogs();
  await cleanupOldLoginAttempts();

  const result: CleanupResult = {
    sessionsDeleted,
    auditLogsDeleted,
    timestamp: new Date(),
  };

  console.log(`Cleanup completed at ${result.timestamp.toISOString()}:`);
  console.log(`  - Sessions deleted: ${sessionsDeleted}`);
  console.log(`  - Audit logs deleted: ${auditLogsDeleted}`);

  return result;
}

/**
 * Get session statistics
 */
export async function getSessionStats(): Promise<{
  totalSessions: number;
  expiredSessions: number;
  activeSessions: number;
}> {
  const totalResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM sessions`
  );
  const expiredResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM sessions WHERE expires_at < NOW()`
  );

  const total = parseInt(totalResult.rows[0]?.count || "0", 10);
  const expired = parseInt(expiredResult.rows[0]?.count || "0", 10);

  return {
    totalSessions: total,
    expiredSessions: expired,
    activeSessions: total - expired,
  };
}

// Allow running as a script
if (require.main === module) {
  runFullCleanup()
    .then((result) => {
      console.log("\nCleanup completed successfully:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Cleanup failed:", error);
      process.exit(1);
    });
}
