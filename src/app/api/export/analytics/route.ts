/**
 * Analytics Export API
 *
 * GET /api/export/analytics - Export analytics data to CSV or JSON
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import { query } from "@/lib/db";
import {
  exportAnalyticsToCSV,
  exportAnalyticsToJSON,
  createCSVResponse,
  createJSONResponse,
  generateFilename,
  type AnalyticsExportData,
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
    const days = parseInt(searchParams.get("days") || "30", 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily aggregated data
    const result = await query(
      `SELECT
        DATE(started_at) as date,
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE direction = 'inbound') as inbound_calls,
        COUNT(*) FILTER (WHERE direction = 'outbound') as outbound_calls,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_calls,
        COUNT(*) FILTER (WHERE status IN ('failed', 'error', 'no_answer')) as failed_calls,
        COALESCE(AVG(duration_seconds), 0) as avg_duration_seconds,
        COALESCE(SUM(duration_seconds), 0) / 60.0 as total_duration_minutes
      FROM calls
      WHERE organization_id = $1
        AND started_at >= $2
      GROUP BY DATE(started_at)
      ORDER BY DATE(started_at) DESC`,
      [user.organizationId, startDate]
    );

    const analytics: AnalyticsExportData[] = result.rows.map((row) => ({
      date: row.date?.toISOString().split("T")[0] || "",
      totalCalls: parseInt(row.total_calls, 10),
      inboundCalls: parseInt(row.inbound_calls, 10),
      outboundCalls: parseInt(row.outbound_calls, 10),
      completedCalls: parseInt(row.completed_calls, 10),
      failedCalls: parseInt(row.failed_calls, 10),
      avgDurationSeconds: parseFloat(row.avg_duration_seconds) || 0,
      totalDurationMinutes: parseFloat(row.total_duration_minutes) || 0,
    }));

    if (format === "json") {
      const json = exportAnalyticsToJSON(analytics);
      return createJSONResponse(json, generateFilename("analytics", "json"));
    }

    const csv = exportAnalyticsToCSV(analytics);
    return createCSVResponse(csv, generateFilename("analytics", "csv"));
  } catch (error) {
    console.error("Analytics export error:", error);
    return NextResponse.json(
      { error: "Failed to export analytics" },
      { status: 500 }
    );
  }
}
