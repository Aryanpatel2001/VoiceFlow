/**
 * Call Stats API Route
 *
 * GET /api/calls/stats - Get call statistics for the organization
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getCallStats } from "@/services/call.service";

export async function GET() {
  try {
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

    const stats = await getCallStats(user.organizationId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Get call stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch call stats" },
      { status: 500 }
    );
  }
}
