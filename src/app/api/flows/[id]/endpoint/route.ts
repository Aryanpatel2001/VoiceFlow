/**
 * Flow Endpoint Settings API
 *
 * GET  /api/flows/[id]/endpoint - Get endpoint details
 * POST /api/flows/[id]/endpoint - Toggle endpoint enabled/disabled
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getFlowById, setEndpointEnabled } from "@/services/flow.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - Get endpoint details
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

    // Build webhook URL
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const webhookUrl = flow.webhookId
      ? `${baseUrl}/api/webhook/${flow.webhookId}`
      : null;

    return NextResponse.json({
      flowId: flow.id,
      flowName: flow.name,
      status: flow.status,
      webhookId: flow.webhookId || null,
      webhookUrl,
      webhookSecret: flow.webhookSecret || null,
      deployedVersion: flow.deployedVersion || null,
      endpointEnabled: flow.endpointEnabled || false,
      instructions: webhookUrl
        ? {
            description:
              "Use this webhook URL to receive voice calls. Send a POST request with the conversation payload.",
            examplePayload: {
              sessionId: "optional-session-id",
              userInput: "User's spoken text",
              currentNodeId: "optional-continue-from-node",
              variables: {},
              conversationHistory: [],
            },
            headers: {
              "Content-Type": "application/json",
              "X-Webhook-Secret": flow.webhookSecret,
            },
          }
        : null,
    });
  } catch (error) {
    console.error("Get endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to get endpoint details" },
      { status: 500 }
    );
  }
}

// POST - Toggle endpoint enabled/disabled
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
    const { enabled } = await request.json();

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled must be a boolean" },
        { status: 400 }
      );
    }

    const flow = await setEndpointEnabled(id, user.organizationId, enabled);

    if (!flow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    return NextResponse.json({
      flowId: flow.id,
      endpointEnabled: flow.endpointEnabled,
      message: enabled ? "Endpoint enabled" : "Endpoint disabled",
    });
  } catch (error) {
    console.error("Toggle endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to update endpoint" },
      { status: 500 }
    );
  }
}
