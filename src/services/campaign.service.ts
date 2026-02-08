/**
 * Campaign Service
 *
 * Database operations for managing outbound calling campaigns and contacts.
 *
 * @module services/campaign
 */

import { query, getClient } from "@/lib/db";

// ============================================
// TYPES
// ============================================

export interface Campaign {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  flow_id: string | null;
  flow_name?: string;
  status: CampaignStatus;
  scheduled_start: Date | null;
  scheduled_end: Date | null;
  allowed_hours_start: string;
  allowed_hours_end: string;
  allowed_days: number[];
  timezone: string;
  max_attempts: number;
  retry_interval_hours: number;
  concurrent_calls: number;
  total_contacts: number;
  completed_contacts: number;
  successful_contacts: number;
  created_at: Date;
  updated_at: Date;
}

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "paused"
  | "completed";

export interface CampaignContact {
  id: string;
  campaign_id: string;
  phone_number: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  custom_data: Record<string, unknown>;
  status: ContactStatus;
  attempts: number;
  last_attempt_at: Date | null;
  call_id: string | null;
  created_at: Date;
}

export type ContactStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "dnc";

export interface CreateCampaignInput {
  name: string;
  description?: string;
  flowId?: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  allowedHoursStart?: string;
  allowedHoursEnd?: string;
  allowedDays?: number[];
  timezone?: string;
  maxAttempts?: number;
  retryIntervalHours?: number;
  concurrentCalls?: number;
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string;
  flowId?: string;
  scheduledStart?: Date | null;
  scheduledEnd?: Date | null;
  allowedHoursStart?: string;
  allowedHoursEnd?: string;
  allowedDays?: number[];
  timezone?: string;
  maxAttempts?: number;
  retryIntervalHours?: number;
  concurrentCalls?: number;
}

export interface CreateContactInput {
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  customData?: Record<string, unknown>;
}

export interface CampaignFilters {
  status?: CampaignStatus;
  flowId?: string;
}

export interface ContactFilters {
  status?: ContactStatus;
  search?: string;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  order?: "asc" | "desc";
}

// ============================================
// CAMPAIGN OPERATIONS
// ============================================

/**
 * Create a new campaign
 */
export async function createCampaign(
  organizationId: string,
  input: CreateCampaignInput
): Promise<Campaign> {
  const result = await query<Campaign>(
    `INSERT INTO campaigns (
      organization_id, name, description, flow_id,
      scheduled_start, scheduled_end,
      allowed_hours_start, allowed_hours_end, allowed_days, timezone,
      max_attempts, retry_interval_hours, concurrent_calls
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      organizationId,
      input.name,
      input.description || null,
      input.flowId || null,
      input.scheduledStart || null,
      input.scheduledEnd || null,
      input.allowedHoursStart || "09:00",
      input.allowedHoursEnd || "17:00",
      input.allowedDays || [1, 2, 3, 4, 5],
      input.timezone || "America/New_York",
      input.maxAttempts || 3,
      input.retryIntervalHours || 24,
      input.concurrentCalls || 5,
    ]
  );

  return result.rows[0];
}

/**
 * Get a campaign by ID
 */
export async function getCampaignById(
  campaignId: string,
  organizationId: string
): Promise<Campaign | null> {
  const result = await query<Campaign & { flow_name: string }>(
    `SELECT c.*, f.name as flow_name
     FROM campaigns c
     LEFT JOIN flows f ON c.flow_id = f.id
     WHERE c.id = $1 AND c.organization_id = $2`,
    [campaignId, organizationId]
  );

  return result.rows[0] || null;
}

/**
 * Get campaigns by organization with filters
 */
export async function getCampaignsByOrganization(
  organizationId: string,
  filters: CampaignFilters = {},
  pagination: PaginationOptions = {}
): Promise<{ campaigns: Campaign[]; total: number }> {
  const {
    limit = 20,
    offset = 0,
    orderBy = "created_at",
    order = "desc",
  } = pagination;

  const whereClauses = ["c.organization_id = $1"];
  const values: unknown[] = [organizationId];
  let paramIndex = 2;

  if (filters.status) {
    whereClauses.push(`c.status = $${paramIndex++}`);
    values.push(filters.status);
  }

  if (filters.flowId) {
    whereClauses.push(`c.flow_id = $${paramIndex++}`);
    values.push(filters.flowId);
  }

  const whereClause = whereClauses.join(" AND ");

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) FROM campaigns c WHERE ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get campaigns with flow name
  const validOrderColumns = [
    "created_at",
    "updated_at",
    "name",
    "status",
    "total_contacts",
  ];
  const safeOrderBy = validOrderColumns.includes(orderBy)
    ? orderBy
    : "created_at";
  const safeOrder = order === "asc" ? "ASC" : "DESC";

  const result = await query<Campaign & { flow_name: string }>(
    `SELECT c.*, f.name as flow_name
     FROM campaigns c
     LEFT JOIN flows f ON c.flow_id = f.id
     WHERE ${whereClause}
     ORDER BY c.${safeOrderBy} ${safeOrder}
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset]
  );

  return {
    campaigns: result.rows,
    total,
  };
}

/**
 * Update a campaign
 */
export async function updateCampaign(
  campaignId: string,
  organizationId: string,
  updates: UpdateCampaignInput
): Promise<Campaign | null> {
  const setParts: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setParts.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    setParts.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }
  if (updates.flowId !== undefined) {
    setParts.push(`flow_id = $${paramIndex++}`);
    values.push(updates.flowId);
  }
  if (updates.scheduledStart !== undefined) {
    setParts.push(`scheduled_start = $${paramIndex++}`);
    values.push(updates.scheduledStart);
  }
  if (updates.scheduledEnd !== undefined) {
    setParts.push(`scheduled_end = $${paramIndex++}`);
    values.push(updates.scheduledEnd);
  }
  if (updates.allowedHoursStart !== undefined) {
    setParts.push(`allowed_hours_start = $${paramIndex++}`);
    values.push(updates.allowedHoursStart);
  }
  if (updates.allowedHoursEnd !== undefined) {
    setParts.push(`allowed_hours_end = $${paramIndex++}`);
    values.push(updates.allowedHoursEnd);
  }
  if (updates.allowedDays !== undefined) {
    setParts.push(`allowed_days = $${paramIndex++}`);
    values.push(updates.allowedDays);
  }
  if (updates.timezone !== undefined) {
    setParts.push(`timezone = $${paramIndex++}`);
    values.push(updates.timezone);
  }
  if (updates.maxAttempts !== undefined) {
    setParts.push(`max_attempts = $${paramIndex++}`);
    values.push(updates.maxAttempts);
  }
  if (updates.retryIntervalHours !== undefined) {
    setParts.push(`retry_interval_hours = $${paramIndex++}`);
    values.push(updates.retryIntervalHours);
  }
  if (updates.concurrentCalls !== undefined) {
    setParts.push(`concurrent_calls = $${paramIndex++}`);
    values.push(updates.concurrentCalls);
  }

  if (setParts.length === 0) {
    return getCampaignById(campaignId, organizationId);
  }

  values.push(campaignId, organizationId);

  const result = await query<Campaign>(
    `UPDATE campaigns SET ${setParts.join(", ")}
     WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows[0] || null;
}

/**
 * Update campaign status
 */
export async function updateCampaignStatus(
  campaignId: string,
  status: CampaignStatus
): Promise<void> {
  await query(
    `UPDATE campaigns SET status = $1 WHERE id = $2`,
    [status, campaignId]
  );
}

/**
 * Delete a campaign (cascade deletes contacts)
 */
export async function deleteCampaign(
  campaignId: string,
  organizationId: string
): Promise<boolean> {
  const result = await query(
    `DELETE FROM campaigns WHERE id = $1 AND organization_id = $2`,
    [campaignId, organizationId]
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Update campaign stats from contacts
 * Optimized to use a single query with FILTER clauses
 */
export async function updateCampaignStats(campaignId: string): Promise<void> {
  await query(
    `UPDATE campaigns c SET
      total_contacts = s.total,
      completed_contacts = s.completed,
      successful_contacts = s.successful
     FROM (
       SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status IN ('completed', 'failed', 'dnc')) as completed,
         COUNT(*) FILTER (WHERE status = 'completed') as successful
       FROM campaign_contacts
       WHERE campaign_id = $1
     ) s
     WHERE c.id = $1`,
    [campaignId]
  );
}

/**
 * Optimized stats update helper for use in transactions
 * Returns the SQL and params for updating campaign stats
 */
export function getStatsUpdateQuery(campaignId: string): { sql: string; params: unknown[] } {
  return {
    sql: `UPDATE campaigns c SET
      total_contacts = s.total,
      completed_contacts = s.completed,
      successful_contacts = s.successful
     FROM (
       SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status IN ('completed', 'failed', 'dnc')) as completed,
         COUNT(*) FILTER (WHERE status = 'completed') as successful
       FROM campaign_contacts
       WHERE campaign_id = $1
     ) s
     WHERE c.id = $1`,
    params: [campaignId],
  };
}

// ============================================
// CONTACT OPERATIONS
// ============================================

/**
 * Add contacts to a campaign (bulk insert)
 */
export async function addContacts(
  campaignId: string,
  contacts: CreateContactInput[]
): Promise<number> {
  if (contacts.length === 0) return 0;

  // Build bulk insert
  const valuePlaceholders: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const contact of contacts) {
    valuePlaceholders.push(
      `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
    );
    values.push(
      campaignId,
      contact.phoneNumber,
      contact.firstName || null,
      contact.lastName || null,
      contact.email || null,
      JSON.stringify(contact.customData || {})
    );
  }

  const result = await query(
    `INSERT INTO campaign_contacts (
      campaign_id, phone_number, first_name, last_name, email, custom_data
    ) VALUES ${valuePlaceholders.join(", ")}
    ON CONFLICT DO NOTHING`,
    values
  );

  // Update campaign stats
  await updateCampaignStats(campaignId);

  return result.rowCount ?? 0;
}

/**
 * Get contacts for a campaign with filters
 */
export async function getContacts(
  campaignId: string,
  filters: ContactFilters = {},
  pagination: PaginationOptions = {}
): Promise<{ contacts: CampaignContact[]; total: number }> {
  const {
    limit = 50,
    offset = 0,
    orderBy = "created_at",
    order = "desc",
  } = pagination;

  const whereClauses = ["campaign_id = $1"];
  const values: unknown[] = [campaignId];
  let paramIndex = 2;

  if (filters.status) {
    whereClauses.push(`status = $${paramIndex++}`);
    values.push(filters.status);
  }

  if (filters.search) {
    whereClauses.push(
      `(phone_number ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`
    );
    values.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = whereClauses.join(" AND ");

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) FROM campaign_contacts WHERE ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get contacts
  const validOrderColumns = [
    "created_at",
    "phone_number",
    "status",
    "attempts",
    "last_attempt_at",
  ];
  const safeOrderBy = validOrderColumns.includes(orderBy)
    ? orderBy
    : "created_at";
  const safeOrder = order === "asc" ? "ASC" : "DESC";

  const result = await query<CampaignContact>(
    `SELECT * FROM campaign_contacts
     WHERE ${whereClause}
     ORDER BY ${safeOrderBy} ${safeOrder}
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset]
  );

  return {
    contacts: result.rows,
    total,
  };
}

/**
 * Get a single contact by ID
 */
export async function getContactById(
  contactId: string
): Promise<CampaignContact | null> {
  const result = await query<CampaignContact>(
    `SELECT * FROM campaign_contacts WHERE id = $1`,
    [contactId]
  );

  return result.rows[0] || null;
}

/**
 * Delete a contact
 */
export async function deleteContact(
  contactId: string,
  campaignId: string
): Promise<boolean> {
  const client = await getClient();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `DELETE FROM campaign_contacts WHERE id = $1 AND campaign_id = $2`,
      [contactId, campaignId]
    );

    if ((result.rowCount ?? 0) > 0) {
      // Update stats using optimized single query
      const statsQuery = getStatsUpdateQuery(campaignId);
      await client.query(statsQuery.sql, statsQuery.params);

      await client.query("COMMIT");
      return true;
    }

    await client.query("ROLLBACK");
    return false;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete multiple contacts by IDs
 */
export async function deleteContacts(
  contactIds: string[],
  campaignId: string
): Promise<number> {
  if (contactIds.length === 0) return 0;

  const client = await getClient();

  try {
    await client.query("BEGIN");

    // Delete contacts
    const placeholders = contactIds.map((_, i) => `$${i + 2}`).join(", ");
    const result = await client.query(
      `DELETE FROM campaign_contacts
       WHERE campaign_id = $1 AND id IN (${placeholders})`,
      [campaignId, ...contactIds]
    );

    const deletedCount = result.rowCount ?? 0;

    if (deletedCount > 0) {
      // Update stats using optimized single query
      const statsQuery = getStatsUpdateQuery(campaignId);
      await client.query(statsQuery.sql, statsQuery.params);
    }

    await client.query("COMMIT");
    return deletedCount;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Bulk update contact status (e.g., mark as DNC)
 */
export async function bulkUpdateContactStatus(
  contactIds: string[],
  campaignId: string,
  status: ContactStatus
): Promise<number> {
  if (contactIds.length === 0) return 0;

  const client = await getClient();

  try {
    await client.query("BEGIN");

    const placeholders = contactIds.map((_, i) => `$${i + 3}`).join(", ");
    const result = await client.query(
      `UPDATE campaign_contacts
       SET status = $1
       WHERE campaign_id = $2 AND id IN (${placeholders})`,
      [status, campaignId, ...contactIds]
    );

    const updatedCount = result.rowCount ?? 0;

    if (updatedCount > 0) {
      // Update stats using optimized single query
      const statsQuery = getStatsUpdateQuery(campaignId);
      await client.query(statsQuery.sql, statsQuery.params);
    }

    await client.query("COMMIT");
    return updatedCount;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ============================================
// EXECUTION QUERIES
// ============================================

/**
 * Get campaigns that are ready to run (status = running)
 */
export async function getCampaignsReadyToRun(): Promise<Campaign[]> {
  const result = await query<Campaign>(
    `SELECT c.* FROM campaigns c
     WHERE c.status = 'running'
       AND (c.scheduled_start IS NULL OR c.scheduled_start <= NOW())
       AND (c.scheduled_end IS NULL OR c.scheduled_end >= NOW())`
  );

  return result.rows;
}

/**
 * Get count of active (in_progress) calls for a campaign
 */
export async function getActiveCampaignCalls(
  campaignId: string
): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) FROM campaign_contacts
     WHERE campaign_id = $1 AND status = 'in_progress'`,
    [campaignId]
  );

  return parseInt(result.rows[0].count, 10);
}

/**
 * Get next contacts for dialing
 * Uses FOR UPDATE SKIP LOCKED to prevent double-dialing
 */
export async function getNextContactsForDialing(
  campaignId: string,
  limit: number,
  retryIntervalHours: number,
  maxAttempts: number
): Promise<CampaignContact[]> {
  const result = await query<CampaignContact>(
    `SELECT * FROM campaign_contacts
     WHERE campaign_id = $1
       AND status = 'pending'
       AND attempts < $2
       AND (
         last_attempt_at IS NULL
         OR last_attempt_at < NOW() - INTERVAL '1 hour' * $3
       )
     ORDER BY created_at ASC
     LIMIT $4
     FOR UPDATE SKIP LOCKED`,
    [campaignId, maxAttempts, retryIntervalHours, limit]
  );

  return result.rows;
}

/**
 * Mark a contact as in_progress (being dialed)
 */
export async function markContactInProgress(contactId: string): Promise<void> {
  await query(
    `UPDATE campaign_contacts
     SET status = 'in_progress', attempts = attempts + 1, last_attempt_at = NOW()
     WHERE id = $1`,
    [contactId]
  );
}

/**
 * Mark a contact as completed (call finished)
 * Uses transaction to ensure data consistency
 */
export async function markContactCompleted(
  contactId: string,
  callId: string,
  success: boolean
): Promise<void> {
  const client = await getClient();

  try {
    await client.query("BEGIN");

    // Update contact status
    const contactResult = await client.query<CampaignContact>(
      `UPDATE campaign_contacts
       SET status = $1, call_id = $2
       WHERE id = $3
       RETURNING campaign_id`,
      [success ? "completed" : "failed", callId, contactId]
    );

    if (contactResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return;
    }

    const campaignId = contactResult.rows[0].campaign_id;

    // Update stats using optimized single query
    const statsQuery = getStatsUpdateQuery(campaignId);
    await client.query(statsQuery.sql, statsQuery.params);

    // Atomically check and update campaign completion status
    await client.query(
      `UPDATE campaigns
       SET status = 'completed'
       WHERE id = $1
         AND status = 'running'
         AND NOT EXISTS (
           SELECT 1 FROM campaign_contacts
           WHERE campaign_id = $1 AND status IN ('pending', 'in_progress')
         )`,
      [campaignId]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Mark a contact as failed (error during dialing)
 */
export async function markContactFailed(contactId: string): Promise<void> {
  // Revert to pending so it can be retried
  await query(
    `UPDATE campaign_contacts
     SET status = 'pending'
     WHERE id = $1`,
    [contactId]
  );
}

/**
 * Check if a campaign is complete and update status
 * Uses atomic UPDATE with subquery to prevent race conditions
 */
export async function checkCampaignCompletion(campaignId: string): Promise<boolean> {
  const result = await query(
    `UPDATE campaigns
     SET status = 'completed'
     WHERE id = $1
       AND status = 'running'
       AND NOT EXISTS (
         SELECT 1 FROM campaign_contacts
         WHERE campaign_id = $1 AND status IN ('pending', 'in_progress')
       )`,
    [campaignId]
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Get campaign stats summary
 */
export async function getCampaignStats(campaignId: string): Promise<{
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  dnc: number;
  successRate: number;
}> {
  const result = await query<{
    status: ContactStatus;
    count: string;
  }>(
    `SELECT status, COUNT(*) as count
     FROM campaign_contacts
     WHERE campaign_id = $1
     GROUP BY status`,
    [campaignId]
  );

  const counts: Record<string, number> = {
    pending: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
    dnc: 0,
  };

  for (const row of result.rows) {
    counts[row.status] = parseInt(row.count, 10);
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const successRate =
    total > 0 ? (counts.completed / total) * 100 : 0;

  return {
    total,
    pending: counts.pending,
    inProgress: counts.in_progress,
    completed: counts.completed,
    failed: counts.failed,
    dnc: counts.dnc,
    successRate: Math.round(successRate * 10) / 10,
  };
}
