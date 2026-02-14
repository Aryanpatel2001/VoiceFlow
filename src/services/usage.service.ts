/**
 * Usage Service
 *
 * Calculates and tracks usage metrics for organizations.
 *
 * @module services/usage
 */

import { query } from "@/lib/db";

// ============================================
// TYPES
// ============================================

export interface UsageStats {
  minutesUsed: number;
  minutesLimit: number;
  percentageUsed: number;
  callsThisMonth: number;
  activeCalls: number;
  phoneNumbersUsed: number;
  phoneNumbersLimit: number;
  plan: string;
  status: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
}

export interface Subscription {
  id: string;
  organizationId: string;
  plan: string;
  status: string;
  minutesIncluded: number;
  concurrentCallsLimit: number;
  phoneNumbersLimit: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
}

// ============================================
// USAGE OPERATIONS
// ============================================

/**
 * Get usage stats for an organization
 */
export async function getUsageStats(organizationId: string): Promise<UsageStats> {
  // Get subscription details
  const subResult = await query<{
    id: string;
    plan: string;
    status: string;
    minutes_included: number;
    concurrent_calls_limit: number;
    phone_numbers_limit: number;
    current_period_start: Date | null;
    current_period_end: Date | null;
    trial_ends_at: Date | null;
  }>(
    `SELECT id, plan, status, minutes_included, concurrent_calls_limit,
            phone_numbers_limit, current_period_start, current_period_end, trial_ends_at
     FROM subscriptions
     WHERE organization_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [organizationId]
  );

  // Default subscription values if none exists
  const subscription = subResult.rows[0] || {
    plan: "starter",
    status: "trialing",
    minutes_included: 2000,
    concurrent_calls_limit: 3,
    phone_numbers_limit: 2,
    current_period_start: null,
    current_period_end: null,
    trial_ends_at: null,
  };

  // Calculate billing period (default to current month)
  const now = new Date();
  const billingPeriodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const billingPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end)
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Get total minutes used this billing period
  const usageResult = await query<{
    total_seconds: string | null;
    total_calls: string;
  }>(
    `SELECT
       COALESCE(SUM(duration_seconds), 0) as total_seconds,
       COUNT(*) as total_calls
     FROM calls
     WHERE organization_id = $1
       AND started_at >= $2
       AND started_at <= $3`,
    [organizationId, billingPeriodStart, billingPeriodEnd]
  );

  const totalSeconds = parseInt(usageResult.rows[0]?.total_seconds || "0", 10);
  const minutesUsed = Math.ceil(totalSeconds / 60);
  const callsThisMonth = parseInt(usageResult.rows[0]?.total_calls || "0", 10);

  // Get active calls count
  const activeCallsResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM calls
     WHERE organization_id = $1
       AND status = 'in-progress'`,
    [organizationId]
  );
  const activeCalls = parseInt(activeCallsResult.rows[0]?.count || "0", 10);

  // Get phone numbers count
  const phoneNumbersResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM phone_numbers
     WHERE organization_id = $1
       AND status = 'active'`,
    [organizationId]
  );
  const phoneNumbersUsed = parseInt(phoneNumbersResult.rows[0]?.count || "0", 10);

  const minutesLimit = subscription.minutes_included;
  const percentageUsed = minutesLimit > 0 ? Math.round((minutesUsed / minutesLimit) * 100) : 0;

  return {
    minutesUsed,
    minutesLimit,
    percentageUsed,
    callsThisMonth,
    activeCalls,
    phoneNumbersUsed,
    phoneNumbersLimit: subscription.phone_numbers_limit,
    plan: subscription.plan,
    status: subscription.status,
    billingPeriodStart: billingPeriodStart.toISOString(),
    billingPeriodEnd: billingPeriodEnd.toISOString(),
  };
}

/**
 * Get subscription details for an organization
 */
export async function getSubscription(organizationId: string): Promise<Subscription | null> {
  const result = await query<{
    id: string;
    organization_id: string;
    plan: string;
    status: string;
    minutes_included: number;
    concurrent_calls_limit: number;
    phone_numbers_limit: number;
    current_period_start: Date;
    current_period_end: Date;
    trial_ends_at: Date | null;
  }>(
    `SELECT id, organization_id, plan, status, minutes_included,
            concurrent_calls_limit, phone_numbers_limit,
            current_period_start, current_period_end, trial_ends_at
     FROM subscriptions
     WHERE organization_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [organizationId]
  );

  if (!result.rows[0]) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    organizationId: row.organization_id,
    plan: row.plan,
    status: row.status,
    minutesIncluded: row.minutes_included,
    concurrentCallsLimit: row.concurrent_calls_limit,
    phoneNumbersLimit: row.phone_numbers_limit,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    trialEndsAt: row.trial_ends_at,
  };
}

/**
 * Check if organization has exceeded usage limits
 */
export async function checkUsageLimits(
  organizationId: string
): Promise<{
  minutesExceeded: boolean;
  concurrentCallsExceeded: boolean;
  phoneNumbersExceeded: boolean;
}> {
  const stats = await getUsageStats(organizationId);

  return {
    minutesExceeded: stats.minutesUsed >= stats.minutesLimit,
    concurrentCallsExceeded: false, // Would need concurrent call limit check
    phoneNumbersExceeded: stats.phoneNumbersUsed >= stats.phoneNumbersLimit,
  };
}
