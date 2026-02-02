/**
 * Flows API Route
 *
 * GET /api/flows - List flows for organization
 * POST /api/flows - Create a new flow
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  createFlow,
  getFlowsByOrganization,
  importFromTemplate,
} from "@/services/flow.service";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as "draft" | "published" | null;
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    const result = await getFlowsByOrganization(user.organizationId, {
      status: status || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("List flows error:", error);
    return NextResponse.json(
      { error: "Failed to list flows" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    const { name, description, templateId, nodes, edges, variables, settings } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    let flow;

    if (templateId) {
      // Create from template
      flow = await importFromTemplate(user.organizationId, templateId, name);
    } else {
      // Create blank or with provided data
      flow = await createFlow(user.organizationId, {
        name,
        description,
        nodes,
        edges,
        variables,
        settings,
      });
    }

    return NextResponse.json({ flow }, { status: 201 });
  } catch (error) {
    console.error("Create flow error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create flow" },
      { status: 500 }
    );
  }
}
