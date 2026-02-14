/**
 * Call Export API
 *
 * GET /api/export/calls - Export calls to CSV or JSON
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import { query } from "@/lib/db";
import {
  exportCallsToCSV,
  exportCallsToJSON,
  createCSVResponse,
  createJSONResponse,
  generateFilename,
  type CallExportData,
} from "@/lib/export";

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = applyRateLimit(request, "read", "export");
    if (rateLimitResponse) return rateLimitResponse;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.organizationId) {
      return NextResponse.json(
        { error: "Organization required" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "csv") as "csv" | "json";
    const status = searchParams.get("status") || undefined;
    const direction = searchParams.get("direction") || undefined;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10000", 10), 10000);

    // Build query
    const conditions = ["c.organization_id = $1"];
    const params: (string | Date)[] = [user.organizationId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`c.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (direction) {
      conditions.push(`c.direction = $${paramIndex}`);
      params.push(direction);
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`c.started_at >= $${paramIndex}`);
      params.push(new Date(startDate));
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`c.started_at <= $${paramIndex}`);
      params.push(new Date(endDate));
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    const result = await query(
      `SELECT
        c.id,
        c.direction,
        c.status,
        c.caller_number,
        c.callee_number,
        c.duration_seconds,
        c.started_at,
        c.ended_at,
        c.sentiment_label,
        c.primary_intent,
        c.transcript,
        f.name as flow_name
      FROM calls c
      LEFT JOIN flows f ON c.flow_id = f.id
      WHERE ${whereClause}
      ORDER BY c.started_at DESC
      LIMIT $${paramIndex}`,
      [...params, limit]
    );

    const calls: CallExportData[] = result.rows.map((row) => ({
      id: row.id,
      direction: row.direction,
      status: row.status,
      callerNumber: row.caller_number,
      calleeNumber: row.callee_number,
      durationSeconds: row.duration_seconds,
      startedAt: row.started_at?.toISOString() || "",
      endedAt: row.ended_at?.toISOString() || null,
      flowName: row.flow_name,
      sentimentLabel: row.sentiment_label,
      primaryIntent: row.primary_intent,
      transcript: row.transcript,
    }));

    if (format === "json") {
      const json = exportCallsToJSON(calls);
      return createJSONResponse(json, generateFilename("calls", "json"));
    }

    const csv = exportCallsToCSV(calls);
    return createCSVResponse(csv, generateFilename("calls", "csv"));
  } catch (error) {
    console.error("Call export error:", error);
    return NextResponse.json(
      { error: "Failed to export calls" },
      { status: 500 }
    );
  }
}
