import { query } from "@/lib/db";

// ============================================
// TYPES
// ============================================

interface AuditLogInput {
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditLog {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  user_email?: string;
  user_name?: string;
}

export interface AuditLogFilters {
  action?: string;
  entityType?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

// ============================================
// OPERATIONS
// ============================================

export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs
        (organization_id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        input.organizationId || null,
        input.userId || null,
        input.action,
        input.entityType || null,
        input.entityId || null,
        input.oldValues ? JSON.stringify(input.oldValues) : null,
        input.newValues ? JSON.stringify(input.newValues) : null,
        input.ipAddress || null,
        input.userAgent || null,
      ]
    );
  } catch (error) {
    console.warn("[Audit] Failed to write audit log:", error);
  }
}

/**
 * Get audit logs for an organization with optional filters
 */
export async function getAuditLogs(
  organizationId: string,
  filters?: AuditLogFilters,
  pagination?: PaginationOptions
): Promise<{ logs: AuditLog[]; total: number }> {
  const whereParts: string[] = ["a.organization_id = $1"];
  const params: unknown[] = [organizationId];
  let paramIndex = 2;

  // Apply filters
  if (filters?.action) {
    whereParts.push(`a.action = $${paramIndex++}`);
    params.push(filters.action);
  }
  if (filters?.entityType) {
    whereParts.push(`a.entity_type = $${paramIndex++}`);
    params.push(filters.entityType);
  }
  if (filters?.userId) {
    whereParts.push(`a.user_id = $${paramIndex++}`);
    params.push(filters.userId);
  }
  if (filters?.startDate) {
    whereParts.push(`a.created_at >= $${paramIndex++}`);
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    whereParts.push(`a.created_at <= $${paramIndex++}`);
    params.push(filters.endDate);
  }

  const whereClause = whereParts.join(" AND ");
  const limit = pagination?.limit || 50;
  const offset = pagination?.offset || 0;

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM audit_logs a WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get paginated results with user info
  const result = await query<AuditLog>(
    `SELECT a.*, u.email as user_email,
            CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as user_name
     FROM audit_logs a
     LEFT JOIN users u ON a.user_id = u.id
     WHERE ${whereClause}
     ORDER BY a.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return { logs: result.rows, total };
}

/**
 * Get unique actions for filter dropdown
 */
export async function getUniqueActions(organizationId: string): Promise<string[]> {
  const result = await query<{ action: string }>(
    `SELECT DISTINCT action FROM audit_logs
     WHERE organization_id = $1
     ORDER BY action ASC`,
    [organizationId]
  );
  return result.rows.map((r) => r.action);
}

/**
 * Get unique entity types for filter dropdown
 */
export async function getUniqueEntityTypes(organizationId: string): Promise<string[]> {
  const result = await query<{ entity_type: string }>(
    `SELECT DISTINCT entity_type FROM audit_logs
     WHERE organization_id = $1 AND entity_type IS NOT NULL
     ORDER BY entity_type ASC`,
    [organizationId]
  );
  return result.rows.map((r) => r.entity_type);
}
