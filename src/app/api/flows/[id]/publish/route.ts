/**
 * Publish Flow API Route
 *
 * POST /api/flows/[id]/publish - Publish a flow (create version)
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { publishFlow } from "@/services/flow.service";

interface RouteContext {
  params: Promise<{ id: string }>;
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

    const version = await publishFlow(id, user.organizationId, user.id);

    if (!version) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    console.error("Publish flow error:", error);

    // Return validation errors
    if (error instanceof Error && error.message.startsWith("Cannot publish:")) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to publish flow" },
      { status: 500 }
    );
  }
}
