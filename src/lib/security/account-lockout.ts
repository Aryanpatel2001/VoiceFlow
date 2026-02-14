/**
 * Account Lockout Security
 *
 * Prevents brute force attacks by locking accounts after failed login attempts.
 *
 * Configuration:
 * - MAX_FAILED_ATTEMPTS: 5 attempts before lockout
 * - LOCKOUT_DURATION_MS: 15 minutes lockout period
 * - ATTEMPT_WINDOW_MS: 15 minutes window for counting attempts
 */

import { query } from "@/lib/db";

// Configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// In-memory cache for login attempts (email -> attempts array)
interface LoginAttempt {
  timestamp: number;
  success: boolean;
}

const loginAttempts = new Map<string, LoginAttempt[]>();

/**
 * Clean up old attempts from the cache
 */
function cleanupAttempts(email: string): void {
  const attempts = loginAttempts.get(email);
  if (!attempts) return;

  const cutoff = Date.now() - ATTEMPT_WINDOW_MS;
  const filtered = attempts.filter((a) => a.timestamp > cutoff);

  if (filtered.length === 0) {
    loginAttempts.delete(email);
  } else {
    loginAttempts.set(email, filtered);
  }
}

/**
 * Get recent failed attempts count for an email
 */
function getFailedAttemptCount(email: string): number {
  cleanupAttempts(email);
  const attempts = loginAttempts.get(email) || [];
  return attempts.filter((a) => !a.success).length;
}

/**
 * Get the most recent failed attempt timestamp
 */
function getLastFailedAttempt(email: string): number | null {
  const attempts = loginAttempts.get(email) || [];
  const failedAttempts = attempts.filter((a) => !a.success);
  if (failedAttempts.length === 0) return null;
  return Math.max(...failedAttempts.map((a) => a.timestamp));
}

/**
 * Check if an account is currently locked
 */
export function isAccountLocked(email: string): {
  locked: boolean;
  remainingMs?: number;
  attempts?: number;
} {
  const normalizedEmail = email.toLowerCase();
  cleanupAttempts(normalizedEmail);

  const failedCount = getFailedAttemptCount(normalizedEmail);

  if (failedCount < MAX_FAILED_ATTEMPTS) {
    return { locked: false, attempts: failedCount };
  }

  const lastFailed = getLastFailedAttempt(normalizedEmail);
  if (!lastFailed) {
    return { locked: false, attempts: 0 };
  }

  const lockoutEndsAt = lastFailed + LOCKOUT_DURATION_MS;
  const now = Date.now();

  if (now >= lockoutEndsAt) {
    // Lockout has expired, clear attempts
    loginAttempts.delete(normalizedEmail);
    return { locked: false, attempts: 0 };
  }

  return {
    locked: true,
    remainingMs: lockoutEndsAt - now,
    attempts: failedCount,
  };
}

/**
 * Record a login attempt
 */
export function recordLoginAttempt(email: string, success: boolean): void {
  const normalizedEmail = email.toLowerCase();
  cleanupAttempts(normalizedEmail);

  const attempts = loginAttempts.get(normalizedEmail) || [];

  if (success) {
    // On successful login, clear all failed attempts
    loginAttempts.delete(normalizedEmail);
  } else {
    // Record the failed attempt
    attempts.push({
      timestamp: Date.now(),
      success: false,
    });
    loginAttempts.set(normalizedEmail, attempts);
  }
}

/**
 * Get lockout status message for API response
 */
export function getLockoutMessage(remainingMs: number): string {
  const minutes = Math.ceil(remainingMs / 60000);
  if (minutes <= 1) {
    return "Account is temporarily locked. Please try again in about a minute.";
  }
  return `Account is temporarily locked due to too many failed login attempts. Please try again in ${minutes} minutes.`;
}

/**
 * Log failed login attempt to audit log (for persistent tracking)
 */
export async function logFailedLoginAttempt(
  email: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (action, entity_type, new_values, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        "failed_login",
        "auth",
        JSON.stringify({ email: email.toLowerCase() }),
        ipAddress || null,
        userAgent || null,
      ]
    );
  } catch (error) {
    // Don't fail the login flow if audit logging fails
    console.error("Failed to log login attempt:", error);
  }
}

/**
 * Get failed login count from database (for cross-instance tracking)
 * This is a fallback for distributed systems
 */
export async function getDbFailedLoginCount(email: string): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - ATTEMPT_WINDOW_MS);
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM audit_logs
       WHERE action = 'failed_login'
       AND new_values->>'email' = $1
       AND created_at > $2`,
      [email.toLowerCase(), cutoff]
    );
    return parseInt(result.rows[0]?.count || "0", 10);
  } catch {
    return 0;
  }
}
