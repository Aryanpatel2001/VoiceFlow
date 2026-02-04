/**
 * Call Service
 *
 * Database operations for managing calls and call events.
 *
 * @module services/call
 */

import { query, getClient } from "@/lib/db";

// ============================================
// TYPES
// ============================================

export interface Call {
  id: string;
  organization_id: string;
  flow_id: string | null;
  phone_number_id: string | null;
  direction: "inbound" | "outbound";
  caller_number: string;
  callee_number: string;
  status: CallStatus;
  started_at: Date;
  answered_at: Date | null;
  ended_at: Date | null;
  duration_seconds: number;
  primary_intent: string | null;
  intent_confidence: number | null;
  sentiment_score: number | null;
  sentiment_label: string | null;
  outcome: string | null;
  outcome_details: string | null;
  recording_url: string | null;
  recording_duration_seconds: number | null;
  transcript: string | null;
  summary: string | null;
  cost_amount: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export type CallStatus =
  | "initiated"
  | "ringing"
  | "in_progress"
  | "completed"
  | "failed"
  | "missed";

export interface CallEvent {
  id: string;
  call_id: string;
  event_type: CallEventType;
  speaker: "ai" | "caller" | "system" | null;
  content: string | null;
  intent: string | null;
  confidence: number | null;
  sentiment: number | null;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export type CallEventType =
  | "transcript"
  | "intent"
  | "action"
  | "error"
  | "transfer"
  | "connected"
  | "ended";

export interface CreateCallInput {
  organizationId: string;
  direction: "inbound" | "outbound";
  callerNumber: string;
  calleeNumber: string;
  flowId?: string;
  phoneNumberId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateCallInput {
  status?: CallStatus;
  answeredAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  primaryIntent?: string;
  intentConfidence?: number;
  sentimentScore?: number;
  sentimentLabel?: string;
  outcome?: string;
  outcomeDetails?: string;
  recordingUrl?: string;
  recordingDurationSeconds?: number;
  transcript?: string;
  summary?: string;
  costAmount?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateCallEventInput {
  callId: string;
  eventType: CallEventType;
  speaker?: "ai" | "caller" | "system";
  content?: string;
  intent?: string;
  confidence?: number;
  sentiment?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface CallFilters {
  status?: CallStatus;
  direction?: "inbound" | "outbound";
  startDate?: Date;
  endDate?: Date;
  phoneNumber?: string;
  flowId?: string;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  orderBy?: "started_at" | "duration_seconds" | "created_at";
  order?: "asc" | "desc";
}

export interface CallWithEvents extends Call {
  events: CallEvent[];
}

// ============================================
// CALL OPERATIONS
// ============================================

/**
 * Create a new call record
 */
export async function createCall(input: CreateCallInput): Promise<Call> {
  const result = await query<Call>(
    `INSERT INTO calls (
      organization_id, direction, caller_number, callee_number,
      flow_id, phone_number_id, status, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, 'initiated', $7)
    RETURNING *`,
    [
      input.organizationId,
      input.direction,
      input.callerNumber,
      input.calleeNumber,
      input.flowId || null,
      input.phoneNumberId || null,
      JSON.stringify(input.metadata || {}),
    ]
  );

  return result.rows[0];
}

/**
 * Update a call record
 */
export async function updateCall(
  callId: string,
  updates: UpdateCallInput
): Promise<Call | null> {
  const setParts: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  // Build dynamic SET clause
  if (updates.status !== undefined) {
    setParts.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.answeredAt !== undefined) {
    setParts.push(`answered_at = $${paramIndex++}`);
    values.push(updates.answeredAt);
  }
  if (updates.endedAt !== undefined) {
    setParts.push(`ended_at = $${paramIndex++}`);
    values.push(updates.endedAt);
  }
  if (updates.durationSeconds !== undefined) {
    setParts.push(`duration_seconds = $${paramIndex++}`);
    values.push(updates.durationSeconds);
  }
  if (updates.primaryIntent !== undefined) {
    setParts.push(`primary_intent = $${paramIndex++}`);
    values.push(updates.primaryIntent);
  }
  if (updates.intentConfidence !== undefined) {
    setParts.push(`intent_confidence = $${paramIndex++}`);
    values.push(updates.intentConfidence);
  }
  if (updates.sentimentScore !== undefined) {
    setParts.push(`sentiment_score = $${paramIndex++}`);
    values.push(updates.sentimentScore);
  }
  if (updates.sentimentLabel !== undefined) {
    setParts.push(`sentiment_label = $${paramIndex++}`);
    values.push(updates.sentimentLabel);
  }
  if (updates.outcome !== undefined) {
    setParts.push(`outcome = $${paramIndex++}`);
    values.push(updates.outcome);
  }
  if (updates.outcomeDetails !== undefined) {
    setParts.push(`outcome_details = $${paramIndex++}`);
    values.push(updates.outcomeDetails);
  }
  if (updates.recordingUrl !== undefined) {
    setParts.push(`recording_url = $${paramIndex++}`);
    values.push(updates.recordingUrl);
  }
  if (updates.recordingDurationSeconds !== undefined) {
    setParts.push(`recording_duration_seconds = $${paramIndex++}`);
    values.push(updates.recordingDurationSeconds);
  }
  if (updates.transcript !== undefined) {
    setParts.push(`transcript = $${paramIndex++}`);
    values.push(updates.transcript);
  }
  if (updates.summary !== undefined) {
    setParts.push(`summary = $${paramIndex++}`);
    values.push(updates.summary);
  }
  if (updates.costAmount !== undefined) {
    setParts.push(`cost_amount = $${paramIndex++}`);
    values.push(updates.costAmount);
  }
  if (updates.metadata !== undefined) {
    setParts.push(`metadata = $${paramIndex++}`);
    values.push(JSON.stringify(updates.metadata));
  }

  if (setParts.length === 0) {
    return getCallById(callId);
  }

  values.push(callId);

  const result = await query<Call>(
    `UPDATE calls SET ${setParts.join(", ")}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows[0] || null;
}

/**
 * Get a call by ID
 */
export async function getCallById(callId: string): Promise<Call | null> {
  const result = await query<Call>(
    `SELECT * FROM calls WHERE id = $1`,
    [callId]
  );

  return result.rows[0] || null;
}

/**
 * Get a call with all its events
 */
export async function getCallWithEvents(
  callId: string
): Promise<CallWithEvents | null> {
  const client = await getClient();

  try {
    const callResult = await client.query<Call>(
      `SELECT * FROM calls WHERE id = $1`,
      [callId]
    );

    if (callResult.rows.length === 0) {
      return null;
    }

    const eventsResult = await client.query<CallEvent>(
      `SELECT * FROM call_events WHERE call_id = $1 ORDER BY timestamp ASC`,
      [callId]
    );

    return {
      ...callResult.rows[0],
      events: eventsResult.rows,
    };
  } finally {
    client.release();
  }
}

/**
 * Get calls for an organization with optional filters
 */
export async function getCallsByOrganization(
  organizationId: string,
  filters?: CallFilters,
  pagination?: PaginationOptions
): Promise<{ calls: Call[]; total: number }> {
  const whereParts: string[] = ["organization_id = $1"];
  const values: unknown[] = [organizationId];
  let paramIndex = 2;

  // Apply filters
  if (filters?.status) {
    whereParts.push(`status = $${paramIndex++}`);
    values.push(filters.status);
  }
  if (filters?.direction) {
    whereParts.push(`direction = $${paramIndex++}`);
    values.push(filters.direction);
  }
  if (filters?.startDate) {
    whereParts.push(`started_at >= $${paramIndex++}`);
    values.push(filters.startDate);
  }
  if (filters?.endDate) {
    whereParts.push(`started_at <= $${paramIndex++}`);
    values.push(filters.endDate);
  }
  if (filters?.phoneNumber) {
    whereParts.push(
      `(caller_number = $${paramIndex} OR callee_number = $${paramIndex})`
    );
    values.push(filters.phoneNumber);
    paramIndex++;
  }
  if (filters?.flowId) {
    whereParts.push(`flow_id = $${paramIndex++}`);
    values.push(filters.flowId);
  }

  const whereClause = whereParts.join(" AND ");
  const orderBy = pagination?.orderBy || "started_at";
  const order = pagination?.order || "desc";
  const limit = pagination?.limit || 50;
  const offset = pagination?.offset || 0;

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM calls WHERE ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get paginated results
  const result = await query<Call>(
    `SELECT * FROM calls
     WHERE ${whereClause}
     ORDER BY ${orderBy} ${order}
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...values, limit, offset]
  );

  return { calls: result.rows, total };
}

/**
 * Get recent calls for an organization
 */
export async function getRecentCalls(
  organizationId: string,
  limit: number = 10
): Promise<Call[]> {
  const result = await query<Call>(
    `SELECT * FROM calls
     WHERE organization_id = $1
     ORDER BY started_at DESC
     LIMIT $2`,
    [organizationId, limit]
  );

  return result.rows;
}

/**
 * Get active (in-progress) calls for an organization
 */
export async function getActiveCalls(organizationId: string): Promise<Call[]> {
  const result = await query<Call>(
    `SELECT * FROM calls
     WHERE organization_id = $1 AND status IN ('initiated', 'ringing', 'in_progress')
     ORDER BY started_at DESC`,
    [organizationId]
  );

  return result.rows;
}

// ============================================
// CALL EVENT OPERATIONS
// ============================================

/**
 * Create a call event
 */
export async function createCallEvent(
  input: CreateCallEventInput
): Promise<CallEvent> {
  const result = await query<CallEvent>(
    `INSERT INTO call_events (
      call_id, event_type, speaker, content, intent,
      confidence, sentiment, duration_ms, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      input.callId,
      input.eventType,
      input.speaker || null,
      input.content || null,
      input.intent || null,
      input.confidence || null,
      input.sentiment || null,
      input.durationMs || null,
      JSON.stringify(input.metadata || {}),
    ]
  );

  return result.rows[0];
}

/**
 * Get events for a call
 */
export async function getCallEvents(callId: string): Promise<CallEvent[]> {
  const result = await query<CallEvent>(
    `SELECT * FROM call_events
     WHERE call_id = $1
     ORDER BY timestamp ASC`,
    [callId]
  );

  return result.rows;
}

/**
 * Get transcript events for a call (for building conversation history)
 */
export async function getCallTranscript(
  callId: string
): Promise<Array<{ speaker: "ai" | "caller"; text: string; timestamp: Date }>> {
  const result = await query<CallEvent>(
    `SELECT speaker, content, timestamp FROM call_events
     WHERE call_id = $1 AND event_type = 'transcript' AND content IS NOT NULL
     ORDER BY timestamp ASC`,
    [callId]
  );

  return result.rows.map((row) => ({
    speaker: row.speaker === "ai" ? "ai" : "caller",
    text: row.content || "",
    timestamp: row.timestamp,
  }));
}

// ============================================
// ANALYTICS HELPERS
// ============================================

/**
 * Get call statistics for an organization
 */
export async function getCallStats(
  organizationId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalCalls: number;
  completedCalls: number;
  missedCalls: number;
  avgDuration: number;
  totalDuration: number;
}> {
  const dateFilter = startDate && endDate
    ? "AND started_at >= $2 AND started_at <= $3"
    : "";
  const params = startDate && endDate
    ? [organizationId, startDate, endDate]
    : [organizationId];

  const result = await query<{
    total_calls: string;
    completed_calls: string;
    missed_calls: string;
    avg_duration: string | null;
    total_duration: string | null;
  }>(
    `SELECT
      COUNT(*) as total_calls,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_calls,
      COUNT(*) FILTER (WHERE status = 'missed') as missed_calls,
      AVG(duration_seconds) FILTER (WHERE status = 'completed') as avg_duration,
      SUM(duration_seconds) as total_duration
    FROM calls
    WHERE organization_id = $1 ${dateFilter}`,
    params
  );

  const row = result.rows[0];
  return {
    totalCalls: parseInt(row.total_calls, 10),
    completedCalls: parseInt(row.completed_calls, 10),
    missedCalls: parseInt(row.missed_calls, 10),
    avgDuration: parseFloat(row.avg_duration || "0"),
    totalDuration: parseInt(row.total_duration || "0", 10),
  };
}
