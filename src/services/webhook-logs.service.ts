/**
 * Webhook Logs Service
 *
 * Service for logging and retrieving webhook executions.
 * Stores webhook logs in the database for debugging and monitoring.
 *
 * @module services/webhook-logs
 */

import { query } from "@/lib/db";

// ============================================
// Types
// ============================================

export interface WebhookLog {
  id: string;
  organizationId: string;
  flowId: string | null;
  webhookId: string;
  method: string;
  path: string;
  statusCode: number;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  responseBody: unknown;
  responseTimeMs: number;
  error: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface CreateWebhookLogInput {
  organizationId: string;
  flowId?: string;
  webhookId: string;
  method: string;
  path: string;
  statusCode: number;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  responseBody: unknown;
  responseTimeMs: number;
  error?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface WebhookLogFilters {
  webhookId?: string;
  flowId?: string;
  statusCode?: number;
  hasError?: boolean;
  startDate?: Date;
  endDate?: Date;
}

// ============================================
// Create Webhook Log
// ============================================

export async function createWebhookLog(
  input: CreateWebhookLogInput
): Promise<WebhookLog> {
  const result = await query<{
    id: string;
    organization_id: string;
    flow_id: string | null;
    webhook_id: string;
    method: string;
    path: string;
    status_code: number;
    request_headers: Record<string, string>;
    request_body: unknown;
    response_body: unknown;
    response_time_ms: number;
    error: string | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: Date;
  }>(
    `INSERT INTO webhook_logs (
      organization_id, flow_id, webhook_id, method, path,
      status_code, request_headers, request_body, response_body,
      response_time_ms, error, ip_address, user_agent
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      input.organizationId,
      input.flowId || null,
      input.webhookId,
      input.method,
      input.path,
      input.statusCode,
      JSON.stringify(input.requestHeaders),
      JSON.stringify(input.requestBody),
      JSON.stringify(input.responseBody),
      input.responseTimeMs,
      input.error || null,
      input.ipAddress || null,
      input.userAgent || null,
    ]
  );

  return rowToWebhookLog(result.rows[0]);
}

// ============================================
// Get Webhook Logs
// ============================================

export async function getWebhookLogs(
  organizationId: string,
  filters?: WebhookLogFilters,
  options?: { limit?: number; offset?: number }
): Promise<{ logs: WebhookLog[]; total: number }> {
  const conditions = ["organization_id = $1"];
  const params: unknown[] = [organizationId];
  let paramIndex = 2;

  if (filters?.webhookId) {
    conditions.push(`webhook_id = $${paramIndex}`);
    params.push(filters.webhookId);
    paramIndex++;
  }

  if (filters?.flowId) {
    conditions.push(`flow_id = $${paramIndex}`);
    params.push(filters.flowId);
    paramIndex++;
  }

  if (filters?.statusCode) {
    conditions.push(`status_code = $${paramIndex}`);
    params.push(filters.statusCode);
    paramIndex++;
  }

  if (filters?.hasError !== undefined) {
    if (filters.hasError) {
      conditions.push("error IS NOT NULL");
    } else {
      conditions.push("error IS NULL");
    }
  }

  if (filters?.startDate) {
    conditions.push(`created_at >= $${paramIndex}`);
    params.push(filters.startDate);
    paramIndex++;
  }

  if (filters?.endDate) {
    conditions.push(`created_at <= $${paramIndex}`);
    params.push(filters.endDate);
    paramIndex++;
  }

  const whereClause = conditions.join(" AND ");

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) FROM webhook_logs WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get logs
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  const result = await query<{
    id: string;
    organization_id: string;
    flow_id: string | null;
    webhook_id: string;
    method: string;
    path: string;
    status_code: number;
    request_headers: Record<string, string> | string;
    request_body: unknown;
    response_body: unknown;
    response_time_ms: number;
    error: string | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: Date;
  }>(
    `SELECT * FROM webhook_logs
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return {
    logs: result.rows.map(rowToWebhookLog),
    total,
  };
}

// ============================================
// Get Webhook Log by ID
// ============================================

export async function getWebhookLogById(
  logId: string,
  organizationId: string
): Promise<WebhookLog | null> {
  const result = await query<{
    id: string;
    organization_id: string;
    flow_id: string | null;
    webhook_id: string;
    method: string;
    path: string;
    status_code: number;
    request_headers: Record<string, string> | string;
    request_body: unknown;
    response_body: unknown;
    response_time_ms: number;
    error: string | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: Date;
  }>(
    `SELECT * FROM webhook_logs WHERE id = $1 AND organization_id = $2`,
    [logId, organizationId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return rowToWebhookLog(result.rows[0]);
}

// ============================================
// Get Webhook Stats
// ============================================

export async function getWebhookStats(
  organizationId: string,
  webhookId?: string
): Promise<{
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTimeMs: number;
}> {
  const conditions = ["organization_id = $1"];
  const params: unknown[] = [organizationId];

  if (webhookId) {
    conditions.push("webhook_id = $2");
    params.push(webhookId);
  }

  const whereClause = conditions.join(" AND ");

  const result = await query<{
    total_requests: string;
    successful_requests: string;
    failed_requests: string;
    avg_response_time: string;
  }>(
    `SELECT
      COUNT(*) as total_requests,
      COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as successful_requests,
      COUNT(*) FILTER (WHERE status_code >= 400 OR error IS NOT NULL) as failed_requests,
      COALESCE(AVG(response_time_ms), 0) as avg_response_time
    FROM webhook_logs
    WHERE ${whereClause}`,
    params
  );

  const row = result.rows[0];
  return {
    totalRequests: parseInt(row.total_requests, 10),
    successfulRequests: parseInt(row.successful_requests, 10),
    failedRequests: parseInt(row.failed_requests, 10),
    avgResponseTimeMs: parseFloat(row.avg_response_time),
  };
}

// ============================================
// Delete Old Logs
// ============================================

export async function deleteOldWebhookLogs(
  organizationId: string,
  olderThanDays: number = 30
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await query(
    `DELETE FROM webhook_logs
     WHERE organization_id = $1 AND created_at < $2`,
    [organizationId, cutoffDate]
  );

  return result.rowCount || 0;
}

// ============================================
// Helper Functions
// ============================================

function rowToWebhookLog(row: {
  id: string;
  organization_id: string;
  flow_id: string | null;
  webhook_id: string;
  method: string;
  path: string;
  status_code: number;
  request_headers: Record<string, string> | string;
  request_body: unknown;
  response_body: unknown;
  response_time_ms: number;
  error: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}): WebhookLog {
  return {
    id: row.id,
    organizationId: row.organization_id,
    flowId: row.flow_id,
    webhookId: row.webhook_id,
    method: row.method,
    path: row.path,
    statusCode: row.status_code,
    requestHeaders:
      typeof row.request_headers === "string"
        ? JSON.parse(row.request_headers)
        : row.request_headers || {},
    requestBody: row.request_body,
    responseBody: row.response_body,
    responseTimeMs: row.response_time_ms,
    error: row.error,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  };
}
