/**
 * Duplicate Flow API Route
 *
 * POST /api/flows/[id]/duplicate - Create a copy of a flow
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { duplicateFlow } from "@/services/flow.service";

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

    const flow = await duplicateFlow(id, user.organizationId);

    if (!flow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    return NextResponse.json({ flow }, { status: 201 });
  } catch (error) {
    console.error("Duplicate flow error:", error);
    return NextResponse.json(
      { error: "Failed to duplicate flow" },
      { status: 500 }
    );
  }
}
