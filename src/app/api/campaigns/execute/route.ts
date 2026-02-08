/**
 * Campaign Execution Trigger API Route
 *
 * POST /api/campaigns/execute - Trigger campaign execution
 *
 * Called by external cron job every minute.
 * Protected by CRON_SECRET environment variable.
 */

import { NextRequest, NextResponse } from "next/server";
import { executeReadyCampaigns } from "@/lib/campaign/executor";
import { applyRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - webhook operations (cron job)
    const rateLimitResponse = applyRateLimit(request, "webhook", "campaigns/execute");
    if (rateLimitResponse) return rateLimitResponse;

    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("[CampaignExecute] CRON_SECRET not configured");
      return NextResponse.json(
        { error: "Server not configured for cron execution" },
        { status: 500 }
      );
    }

    const expectedAuth = `Bearer ${cronSecret}`;
    if (authHeader !== expectedAuth) {
      console.warn("[CampaignExecute] Unauthorized execution attempt");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Execute all ready campaigns
    const summary = await executeReadyCampaigns();

    return NextResponse.json({
      success: true,
      timestamp: summary.timestamp.toISOString(),
      campaignsProcessed: summary.campaignsProcessed,
      totalCallsInitiated: summary.totalCallsInitiated,
      results: summary.results.map((r) => ({
        campaignId: r.campaignId,
        campaignName: r.campaignName,
        callsInitiated: r.callsInitiated,
        skipped: r.skipped,
        skipReason: r.skipReason,
        errorCount: r.errors.length,
      })),
    });
  } catch (error) {
    console.error("[CampaignExecute] Error:", error);
    return NextResponse.json(
      { error: "Execution failed" },
      { status: 500 }
    );
  }
}

// Also support GET for health checks
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "Campaign execution trigger",
    method: "POST with Authorization: Bearer <CRON_SECRET>",
  });
}
