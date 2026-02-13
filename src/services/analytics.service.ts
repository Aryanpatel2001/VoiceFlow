/**
 * Analytics Service
 *
 * Database operations for analytics data and metrics.
 *
 * @module services/analytics
 */

import { query } from "@/lib/db";

// ============================================
// TYPES
// ============================================

export interface CallVolumeData {
  date: string;
  inbound: number;
  outbound: number;
  total: number;
}

export interface OutcomeData {
  status: string;
  count: number;
  percentage: number;
}

export interface SentimentData {
  label: string;
  count: number;
  percentage: number;
}

export interface HourlyDistribution {
  hour: number;
  count: number;
}

export interface FlowPerformance {
  flowId: string;
  flowName: string;
  totalCalls: number;
  completedCalls: number;
  avgDuration: number;
  successRate: number;
}

export interface AnalyticsOverview {
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  avgDuration: number;
  totalDuration: number;
  successRate: number;
  avgSentiment: number | null;
  totalCost: number;
}

export interface AnalyticsFilters {
  startDate: Date;
  endDate: Date;
  flowId?: string;
  direction?: "inbound" | "outbound";
}

// ============================================
// ANALYTICS OPERATIONS
// ============================================

/**
 * Get analytics overview for an organization
 */
export async function getAnalyticsOverview(
  organizationId: string,
  filters: AnalyticsFilters
): Promise<AnalyticsOverview> {
  const whereParts = [
    "organization_id = $1",
    "started_at >= $2",
    "started_at <= $3",
  ];
  const params: unknown[] = [organizationId, filters.startDate, filters.endDate];
  let paramIndex = 4;

  if (filters.flowId) {
    whereParts.push(`flow_id = $${paramIndex++}`);
    params.push(filters.flowId);
  }
  if (filters.direction) {
    whereParts.push(`direction = $${paramIndex++}`);
    params.push(filters.direction);
  }

  const whereClause = whereParts.join(" AND ");

  const result = await query<{
    total_calls: string;
    completed_calls: string;
    failed_calls: string;
    avg_duration: string | null;
    total_duration: string | null;
    avg_sentiment: string | null;
    total_cost: string | null;
  }>(
    `SELECT
      COUNT(*) as total_calls,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_calls,
      COUNT(*) FILTER (WHERE status IN ('failed', 'missed')) as failed_calls,
      AVG(duration_seconds) FILTER (WHERE status = 'completed' AND duration_seconds > 0) as avg_duration,
      SUM(duration_seconds) as total_duration,
      AVG(sentiment_score) FILTER (WHERE sentiment_score IS NOT NULL) as avg_sentiment,
      SUM(cost_amount) as total_cost
    FROM calls
    WHERE ${whereClause}`,
    params
  );

  const row = result.rows[0];
  const totalCalls = parseInt(row.total_calls, 10);
  const completedCalls = parseInt(row.completed_calls, 10);

  return {
    totalCalls,
    completedCalls,
    failedCalls: parseInt(row.failed_calls, 10),
    avgDuration: parseFloat(row.avg_duration || "0"),
    totalDuration: parseInt(row.total_duration || "0", 10),
    successRate: totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0,
    avgSentiment: row.avg_sentiment ? parseFloat(row.avg_sentiment) : null,
    totalCost: parseFloat(row.total_cost || "0"),
  };
}

/**
 * Get call volume by day
 */
export async function getCallVolumeByDay(
  organizationId: string,
  filters: AnalyticsFilters
): Promise<CallVolumeData[]> {
  const whereParts = [
    "organization_id = $1",
    "started_at >= $2",
    "started_at <= $3",
  ];
  const params: unknown[] = [organizationId, filters.startDate, filters.endDate];
  let paramIndex = 4;

  if (filters.flowId) {
    whereParts.push(`flow_id = $${paramIndex++}`);
    params.push(filters.flowId);
  }
  if (filters.direction) {
    whereParts.push(`direction = $${paramIndex++}`);
    params.push(filters.direction);
  }

  const whereClause = whereParts.join(" AND ");

  const result = await query<{
    date: Date;
    inbound: string;
    outbound: string;
    total: string;
  }>(
    `SELECT
      DATE(started_at) as date,
      COUNT(*) FILTER (WHERE direction = 'inbound') as inbound,
      COUNT(*) FILTER (WHERE direction = 'outbound') as outbound,
      COUNT(*) as total
    FROM calls
    WHERE ${whereClause}
    GROUP BY DATE(started_at)
    ORDER BY date ASC`,
    params
  );

  return result.rows.map((row) => ({
    date: row.date.toISOString().split("T")[0],
    inbound: parseInt(row.inbound, 10),
    outbound: parseInt(row.outbound, 10),
    total: parseInt(row.total, 10),
  }));
}

/**
 * Get call outcomes breakdown
 */
export async function getCallOutcomes(
  organizationId: string,
  filters: AnalyticsFilters
): Promise<OutcomeData[]> {
  const whereParts = [
    "organization_id = $1",
    "started_at >= $2",
    "started_at <= $3",
  ];
  const params: unknown[] = [organizationId, filters.startDate, filters.endDate];
  let paramIndex = 4;

  if (filters.flowId) {
    whereParts.push(`flow_id = $${paramIndex++}`);
    params.push(filters.flowId);
  }
  if (filters.direction) {
    whereParts.push(`direction = $${paramIndex++}`);
    params.push(filters.direction);
  }

  const whereClause = whereParts.join(" AND ");

  const result = await query<{
    status: string;
    count: string;
  }>(
    `SELECT status, COUNT(*) as count
    FROM calls
    WHERE ${whereClause}
    GROUP BY status
    ORDER BY count DESC`,
    params
  );

  const total = result.rows.reduce((sum, row) => sum + parseInt(row.count, 10), 0);

  return result.rows.map((row) => {
    const count = parseInt(row.count, 10);
    return {
      status: row.status,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    };
  });
}

/**
 * Get sentiment breakdown
 */
export async function getSentimentBreakdown(
  organizationId: string,
  filters: AnalyticsFilters
): Promise<SentimentData[]> {
  const whereParts = [
    "organization_id = $1",
    "started_at >= $2",
    "started_at <= $3",
    "sentiment_label IS NOT NULL",
  ];
  const params: unknown[] = [organizationId, filters.startDate, filters.endDate];
  let paramIndex = 4;

  if (filters.flowId) {
    whereParts.push(`flow_id = $${paramIndex++}`);
    params.push(filters.flowId);
  }
  if (filters.direction) {
    whereParts.push(`direction = $${paramIndex++}`);
    params.push(filters.direction);
  }

  const whereClause = whereParts.join(" AND ");

  const result = await query<{
    sentiment_label: string;
    count: string;
  }>(
    `SELECT sentiment_label, COUNT(*) as count
    FROM calls
    WHERE ${whereClause}
    GROUP BY sentiment_label
    ORDER BY count DESC`,
    params
  );

  const total = result.rows.reduce((sum, row) => sum + parseInt(row.count, 10), 0);

  return result.rows.map((row) => {
    const count = parseInt(row.count, 10);
    return {
      label: row.sentiment_label,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    };
  });
}

/**
 * Get hourly call distribution
 */
export async function getHourlyDistribution(
  organizationId: string,
  filters: AnalyticsFilters
): Promise<HourlyDistribution[]> {
  const whereParts = [
    "organization_id = $1",
    "started_at >= $2",
    "started_at <= $3",
  ];
  const params: unknown[] = [organizationId, filters.startDate, filters.endDate];
  let paramIndex = 4;

  if (filters.flowId) {
    whereParts.push(`flow_id = $${paramIndex++}`);
    params.push(filters.flowId);
  }
  if (filters.direction) {
    whereParts.push(`direction = $${paramIndex++}`);
    params.push(filters.direction);
  }

  const whereClause = whereParts.join(" AND ");

  const result = await query<{
    hour: string;
    count: string;
  }>(
    `SELECT EXTRACT(HOUR FROM started_at) as hour, COUNT(*) as count
    FROM calls
    WHERE ${whereClause}
    GROUP BY hour
    ORDER BY hour ASC`,
    params
  );

  // Fill in missing hours with 0
  const hourMap = new Map(result.rows.map((r) => [parseInt(r.hour, 10), parseInt(r.count, 10)]));
  const distribution: HourlyDistribution[] = [];
  for (let h = 0; h < 24; h++) {
    distribution.push({ hour: h, count: hourMap.get(h) || 0 });
  }

  return distribution;
}

/**
 * Get flow performance metrics
 */
export async function getFlowPerformance(
  organizationId: string,
  filters: AnalyticsFilters
): Promise<FlowPerformance[]> {
  const whereParts = [
    "c.organization_id = $1",
    "c.started_at >= $2",
    "c.started_at <= $3",
    "c.flow_id IS NOT NULL",
  ];
  const params: unknown[] = [organizationId, filters.startDate, filters.endDate];
  let paramIndex = 4;

  if (filters.flowId) {
    whereParts.push(`c.flow_id = $${paramIndex++}`);
    params.push(filters.flowId);
  }
  if (filters.direction) {
    whereParts.push(`c.direction = $${paramIndex++}`);
    params.push(filters.direction);
  }

  const whereClause = whereParts.join(" AND ");

  const result = await query<{
    flow_id: string;
    flow_name: string;
    total_calls: string;
    completed_calls: string;
    avg_duration: string | null;
  }>(
    `SELECT
      c.flow_id,
      f.name as flow_name,
      COUNT(*) as total_calls,
      COUNT(*) FILTER (WHERE c.status = 'completed') as completed_calls,
      AVG(c.duration_seconds) FILTER (WHERE c.status = 'completed') as avg_duration
    FROM calls c
    LEFT JOIN flows f ON c.flow_id = f.id
    WHERE ${whereClause}
    GROUP BY c.flow_id, f.name
    ORDER BY total_calls DESC
    LIMIT 10`,
    params
  );

  return result.rows.map((row) => {
    const totalCalls = parseInt(row.total_calls, 10);
    const completedCalls = parseInt(row.completed_calls, 10);
    return {
      flowId: row.flow_id,
      flowName: row.flow_name || "Unknown Flow",
      totalCalls,
      completedCalls,
      avgDuration: parseFloat(row.avg_duration || "0"),
      successRate: totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0,
    };
  });
}

/**
 * Get comparison with previous period
 */
export async function getPeriodComparison(
  organizationId: string,
  currentStart: Date,
  currentEnd: Date
): Promise<{
  current: AnalyticsOverview;
  previous: AnalyticsOverview;
  changes: {
    totalCalls: number;
    successRate: number;
    avgDuration: number;
  };
}> {
  // Calculate previous period (same duration, immediately before)
  const duration = currentEnd.getTime() - currentStart.getTime();
  const previousStart = new Date(currentStart.getTime() - duration);
  const previousEnd = new Date(currentStart.getTime());

  const [current, previous] = await Promise.all([
    getAnalyticsOverview(organizationId, { startDate: currentStart, endDate: currentEnd }),
    getAnalyticsOverview(organizationId, { startDate: previousStart, endDate: previousEnd }),
  ]);

  const calcChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  return {
    current,
    previous,
    changes: {
      totalCalls: calcChange(current.totalCalls, previous.totalCalls),
      successRate: current.successRate - previous.successRate,
      avgDuration: calcChange(current.avgDuration, previous.avgDuration),
    },
  };
}
