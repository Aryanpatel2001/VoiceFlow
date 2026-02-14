/**
 * Webhook Logs API
 *
 * GET /api/webhook-logs - Get webhook logs with filters
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import {
  getWebhookLogs,
  getWebhookLogById,
  getWebhookStats,
} from "@/services/webhook-logs.service";

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = applyRateLimit(request, "read", "webhook-logs");
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

    // Check if requesting a specific log
    const logId = searchParams.get("id");
    if (logId) {
      const log = await getWebhookLogById(logId, user.organizationId);
      if (!log) {
        return NextResponse.json({ error: "Log not found" }, { status: 404 });
      }
      return NextResponse.json({ log });
    }

    // Check if requesting stats
    const getStats = searchParams.get("stats") === "true";
    if (getStats) {
      const webhookId = searchParams.get("webhookId") || undefined;
      const stats = await getWebhookStats(user.organizationId, webhookId);
      return NextResponse.json({ stats });
    }

    // Parse filters
    const webhookId = searchParams.get("webhookId") || undefined;
    const flowId = searchParams.get("flowId") || undefined;
    const statusCode = searchParams.get("statusCode")
      ? parseInt(searchParams.get("statusCode")!, 10)
      : undefined;
    const hasError =
      searchParams.get("hasError") === "true"
        ? true
        : searchParams.get("hasError") === "false"
        ? false
        : undefined;
    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : undefined;
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : undefined;

    // Parse pagination
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      100
    );
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const { logs, total } = await getWebhookLogs(
      user.organizationId,
      { webhookId, flowId, statusCode, hasError, startDate, endDate },
      { limit, offset }
    );

    return NextResponse.json({
      logs,
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + logs.length < total,
      },
    });
  } catch (error) {
    console.error("Webhook logs GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch webhook logs" },
      { status: 500 }
    );
  }
}
