/**
 * Audit Logs API
 *
 * GET /api/audit-logs - Get audit logs with filters and pagination
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import {
  getAuditLogs,
  getUniqueActions,
  getUniqueEntityTypes,
} from "@/services/audit.service";

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = applyRateLimit(request, "read", "audit-logs");
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

    // Parse filters
    const action = searchParams.get("action") || undefined;
    const entityType = searchParams.get("entityType") || undefined;
    const userId = searchParams.get("userId") || undefined;
    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : undefined;
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : undefined;

    // Parse pagination
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Check if requesting filter options
    const getFilters = searchParams.get("filters") === "true";
    if (getFilters) {
      const [actions, entityTypes] = await Promise.all([
        getUniqueActions(orgId),
        getUniqueEntityTypes(orgId),
      ]);
      return NextResponse.json({ actions, entityTypes });
    }

    // Get audit logs
    const { logs, total } = await getAuditLogs(
      orgId,
      { action, entityType, userId, startDate, endDate },
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
    console.error("Audit logs API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
