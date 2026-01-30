/**
 * Flow Versions API Route
 *
 * GET /api/flows/[id]/versions - Get all versions of a flow
 * POST /api/flows/[id]/versions - Rollback to a specific version
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getFlowVersions, rollbackToVersion } from "@/services/flow.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
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

    const { id } = await context.params;
    const versions = await getFlowVersions(id, user.organizationId);

    return NextResponse.json({ versions });
  } catch (error) {
    console.error("Get flow versions error:", error);
    return NextResponse.json(
      { error: "Failed to get flow versions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
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

    const { id } = await context.params;
    const body = await request.json();
    const { versionNumber } = body;

    if (typeof versionNumber !== "number") {
      return NextResponse.json(
        { error: "versionNumber is required" },
        { status: 400 }
      );
    }

    const flow = await rollbackToVersion(id, versionNumber, user.organizationId);

    if (!flow) {
      return NextResponse.json(
        { error: "Flow or version not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ flow });
  } catch (error) {
    console.error("Rollback flow error:", error);
    return NextResponse.json(
      { error: "Failed to rollback flow" },
      { status: 500 }
    );
  }
}
