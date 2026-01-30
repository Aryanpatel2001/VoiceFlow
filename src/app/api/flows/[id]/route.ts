/**
 * Flow Detail API Route
 *
 * GET /api/flows/[id] - Get a flow by ID
 * PATCH /api/flows/[id] - Update a flow
 * DELETE /api/flows/[id] - Delete a flow
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getFlowById,
  updateFlow,
  deleteFlow,
} from "@/services/flow.service";

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
    const flow = await getFlowById(id, user.organizationId);

    if (!flow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    return NextResponse.json({ flow });
  } catch (error) {
    console.error("Get flow error:", error);
    return NextResponse.json(
      { error: "Failed to get flow" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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
    const { name, description, nodes, edges, variables, settings } = body;

    const flow = await updateFlow(id, user.organizationId, {
      name,
      description,
      nodes,
      edges,
      variables,
      settings,
    });

    if (!flow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    return NextResponse.json({ flow });
  } catch (error) {
    console.error("Update flow error:", error);
    return NextResponse.json(
      { error: "Failed to update flow" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
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
    const deleted = await deleteFlow(id, user.organizationId);

    if (!deleted) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete flow error:", error);
    return NextResponse.json(
      { error: "Failed to delete flow" },
      { status: 500 }
    );
  }
}
