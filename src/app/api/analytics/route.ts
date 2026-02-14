/**
 * Analytics API
 *
 * GET /api/analytics - Get analytics data with filters
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import {
  getAnalyticsOverview,
  getCallVolumeByDay,
  getCallOutcomes,
  getSentimentBreakdown,
  getHourlyDistribution,
  getFlowPerformance,
  getPeriodComparison,
} from "@/services/analytics.service";

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = applyRateLimit(request, "read", "analytics");
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
    const { searchParams } = new URL(request.url);

    // Parse date range (default: last 30 days)
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : defaultStart;
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : now;

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    // Optional filters
    const flowId = searchParams.get("flowId") || undefined;
    const direction = searchParams.get("direction") as "inbound" | "outbound" | undefined;

    const filters = { startDate, endDate, flowId, direction };

    // Fetch all analytics data in parallel
    const [
      overview,
      callVolume,
      outcomes,
      sentiment,
      hourlyDistribution,
      flowPerformance,
      comparison,
    ] = await Promise.all([
      getAnalyticsOverview(orgId, filters),
      getCallVolumeByDay(orgId, filters),
      getCallOutcomes(orgId, filters),
      getSentimentBreakdown(orgId, filters),
      getHourlyDistribution(orgId, filters),
      getFlowPerformance(orgId, filters),
      getPeriodComparison(orgId, startDate, endDate),
    ]);

    return NextResponse.json({
      overview,
      callVolume,
      outcomes,
      sentiment,
      hourlyDistribution,
      flowPerformance,
      comparison,
      filters: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        flowId,
        direction,
      },
    });
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
