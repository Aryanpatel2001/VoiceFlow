/**
 * Dashboard Stats API
 *
 * GET /api/dashboard/stats - Get dashboard statistics
 *
 * Returns call statistics, recent calls, and live calls.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import { query } from "@/lib/db";

interface DashboardStats {
  totalCalls: {
    value: number;
    change: number;
    trend: "up" | "down" | "neutral";
  };
  avgDuration: {
    value: number;
    change: number;
    trend: "up" | "down" | "neutral";
  };
  successRate: {
    value: number;
    change: number;
    trend: "up" | "down" | "neutral";
  };
  activeFlows: {
    value: number;
    change: number;
    trend: "up" | "down" | "neutral";
  };
  recentCalls: Array<{
    id: string;
    phoneNumber: string;
    direction: "inbound" | "outbound";
    status: "completed" | "missed" | "failed" | "in_progress";
    duration: number;
    flowName: string | null;
    summary: string | null;
    startedAt: string;
  }>;
  liveCalls: Array<{
    id: string;
    phoneNumber: string;
    flowName: string | null;
    duration: number;
    status: "in_progress" | "ringing";
  }>;
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = applyRateLimit(request, "read", "dashboard/stats");
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

    const orgId = user.organizationId;

    // Calculate date ranges
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Get current period stats (last 7 days)
    const currentStats = await query<{
      total_calls: string;
      completed_calls: string;
      failed_calls: string;
      avg_duration: string | null;
    }>(
      `SELECT
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_calls,
        COUNT(*) FILTER (WHERE status IN ('failed', 'missed')) as failed_calls,
        AVG(duration_seconds) FILTER (WHERE status = 'completed' AND duration_seconds > 0) as avg_duration
      FROM calls
      WHERE organization_id = $1 AND started_at >= $2`,
      [orgId, oneWeekAgo]
    );

    // Get previous period stats (7-14 days ago)
    const previousStats = await query<{
      total_calls: string;
      completed_calls: string;
      failed_calls: string;
      avg_duration: string | null;
    }>(
      `SELECT
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_calls,
        COUNT(*) FILTER (WHERE status IN ('failed', 'missed')) as failed_calls,
        AVG(duration_seconds) FILTER (WHERE status = 'completed' AND duration_seconds > 0) as avg_duration
      FROM calls
      WHERE organization_id = $1 AND started_at >= $2 AND started_at < $3`,
      [orgId, twoWeeksAgo, oneWeekAgo]
    );

    // Get active flows count
    const flowsResult = await query<{ current: string; previous: string }>(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'published') as current,
        COUNT(*) FILTER (WHERE status = 'published' AND updated_at < $2) as previous
      FROM flows
      WHERE organization_id = $1`,
      [orgId, oneWeekAgo]
    );

    // Get recent calls with flow names
    const recentCallsResult = await query<{
      id: string;
      caller_number: string;
      callee_number: string;
      direction: "inbound" | "outbound";
      status: string;
      duration_seconds: number;
      flow_name: string | null;
      summary: string | null;
      started_at: Date;
    }>(
      `SELECT
        c.id,
        c.caller_number,
        c.callee_number,
        c.direction,
        c.status,
        c.duration_seconds,
        f.name as flow_name,
        c.summary,
        c.started_at
      FROM calls c
      LEFT JOIN flows f ON c.flow_id = f.id
      WHERE c.organization_id = $1
      ORDER BY c.started_at DESC
      LIMIT 5`,
      [orgId]
    );

    // Get live (active) calls
    const liveCallsResult = await query<{
      id: string;
      caller_number: string;
      callee_number: string;
      direction: "inbound" | "outbound";
      flow_name: string | null;
      started_at: Date;
      status: string;
    }>(
      `SELECT
        c.id,
        c.caller_number,
        c.callee_number,
        c.direction,
        f.name as flow_name,
        c.started_at,
        c.status
      FROM calls c
      LEFT JOIN flows f ON c.flow_id = f.id
      WHERE c.organization_id = $1 AND c.status IN ('in_progress', 'ringing', 'initiated')
      ORDER BY c.started_at DESC`,
      [orgId]
    );

    // Calculate stats
    const current = currentStats.rows[0];
    const previous = previousStats.rows[0];
    const flows = flowsResult.rows[0];

    const currentTotal = parseInt(current.total_calls, 10);
    const previousTotal = parseInt(previous.total_calls, 10);
    const totalChange = previousTotal > 0
      ? ((currentTotal - previousTotal) / previousTotal) * 100
      : currentTotal > 0 ? 100 : 0;

    const currentAvgDuration = parseFloat(current.avg_duration || "0");
    const previousAvgDuration = parseFloat(previous.avg_duration || "0");
    const durationChange = previousAvgDuration > 0
      ? ((currentAvgDuration - previousAvgDuration) / previousAvgDuration) * 100
      : currentAvgDuration > 0 ? 100 : 0;

    const currentCompleted = parseInt(current.completed_calls, 10);
    const currentSuccessRate = currentTotal > 0
      ? (currentCompleted / currentTotal) * 100
      : 0;
    const previousCompleted = parseInt(previous.completed_calls, 10);
    const previousSuccessRate = previousTotal > 0
      ? (previousCompleted / previousTotal) * 100
      : 0;
    const successRateChange = previousSuccessRate > 0
      ? currentSuccessRate - previousSuccessRate
      : currentSuccessRate > 0 ? currentSuccessRate : 0;

    const currentFlows = parseInt(flows.current, 10);
    const previousFlows = parseInt(flows.previous, 10);
    const flowsChange = currentFlows - previousFlows;

    // Build response
    const stats: DashboardStats = {
      totalCalls: {
        value: currentTotal,
        change: Math.round(totalChange * 10) / 10,
        trend: totalChange > 0 ? "up" : totalChange < 0 ? "down" : "neutral",
      },
      avgDuration: {
        value: Math.round(currentAvgDuration),
        change: Math.round(durationChange * 10) / 10,
        trend: durationChange > 0 ? "up" : durationChange < 0 ? "down" : "neutral",
      },
      successRate: {
        value: Math.round(currentSuccessRate * 10) / 10,
        change: Math.round(successRateChange * 10) / 10,
        trend: successRateChange > 0 ? "up" : successRateChange < 0 ? "down" : "neutral",
      },
      activeFlows: {
        value: currentFlows,
        change: flowsChange,
        trend: flowsChange > 0 ? "up" : flowsChange < 0 ? "down" : "neutral",
      },
      recentCalls: recentCallsResult.rows.map((call) => ({
        id: call.id,
        phoneNumber: call.direction === "inbound" ? call.caller_number : call.callee_number,
        direction: call.direction,
        status: call.status as "completed" | "missed" | "failed" | "in_progress",
        duration: call.duration_seconds || 0,
        flowName: call.flow_name,
        summary: call.summary,
        startedAt: call.started_at.toISOString(),
      })),
      liveCalls: liveCallsResult.rows.map((call) => ({
        id: call.id,
        phoneNumber: call.direction === "inbound" ? call.caller_number : call.callee_number,
        flowName: call.flow_name,
        duration: Math.floor((Date.now() - new Date(call.started_at).getTime()) / 1000),
        status: call.status as "in_progress" | "ringing",
      })),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
