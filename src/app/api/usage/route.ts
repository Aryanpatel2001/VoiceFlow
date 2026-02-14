/**
 * Usage API Route
 *
 * GET /api/usage - Get organization usage stats
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import { getUsageStats } from "@/services/usage.service";

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = applyRateLimit(request, "read", "usage");
    if (rateLimitResult) return rateLimitResult;

    const user = await getAuthenticatedUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stats = await getUsageStats(user.organizationId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching usage stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage stats" },
      { status: 500 }
    );
  }
}
