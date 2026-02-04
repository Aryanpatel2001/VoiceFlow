/**
 * Validate Flow API Route
 *
 * POST /api/flows/[id]/validate - Validate a flow's structure and configuration
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getFlowById, validateFlowData } from "@/services/flow.service";
import { validateSinglePromptConfig } from "@/lib/prompt-agent";

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

    // Check if validating saved flow or provided data
    const contentType = request.headers.get("content-type");
    let flowData;

    if (contentType?.includes("application/json")) {
      const body = await request.json();
      if (body.nodes && body.edges && body.variables) {
        // Validate provided data
        flowData = body;
      }
    }

    const flow = await getFlowById(id, user.organizationId);
    if (!flow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }
    if (!flowData) {
      flowData = flow.flowData;
    }

    if (flow.agentMode === "single_prompt") {
      const result = validateSinglePromptConfig(flow.flowData.settings.promptConfig);
      return NextResponse.json({
        valid: result.valid,
        errors: result.errors.map((e) => ({ message: e })),
        warnings: [],
      });
    }

    const result = validateFlowData(flowData);

    return NextResponse.json({
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
    });
  } catch (error) {
    console.error("Validate flow error:", error);
    return NextResponse.json(
      { error: "Failed to validate flow" },
      { status: 500 }
    );
  }
}
