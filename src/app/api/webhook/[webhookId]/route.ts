/**
 * Production Webhook API Route
 *
 * This endpoint handles incoming voice calls from Twilio/LiveKit.
 * Each published flow gets a unique webhook URL for routing calls.
 *
 * POST /api/webhook/[webhookId] - Handle incoming call or conversation turn
 * GET  /api/webhook/[webhookId] - Verify webhook is active
 */

import { NextResponse } from "next/server";
import { getFlowByWebhookId, getPublishedFlowVersion } from "@/services/flow.service";
import { query } from "@/lib/db";
import {
  executeNode,
  findStartNode,
  initializeVariables,
} from "@/lib/canvas/server-execution-engine";

interface RouteContext {
  params: Promise<{ webhookId: string }>;
}

interface WebhookPayload {
  // Call info
  callId?: string;
  callSid?: string; // Twilio
  direction?: "inbound" | "outbound";
  callerNumber?: string;
  calleeNumber?: string;

  // Conversation
  sessionId?: string;
  userInput?: string;
  speechResult?: string; // STT result

  // State
  currentNodeId?: string;
  variables?: Record<string, unknown>;
  conversationHistory?: Array<{ role: string; content: string }>;

  // Provider
  provider?: "twilio" | "livekit" | "test";
}

interface WebhookResponse {
  response: string;
  action: "speak" | "transfer" | "end" | "gather";
  nextNodeId: string | null;
  variables: Record<string, unknown>;
  transferTo?: string;
  gatherOptions?: {
    timeout: number;
    speechModel?: string;
  };
}

// Validate webhook secret from request headers
function validateWebhookSecret(request: Request, flow: { webhookSecret?: string }): boolean {
  // Internal callers (Twilio handler, voice agent) pass x-internal-caller header
  const internalCaller = request.headers.get("x-internal-caller");
  if (internalCaller === process.env.NEXTAUTH_SECRET) {
    return true;
  }

  // External callers must provide the webhook secret
  const providedSecret = request.headers.get("x-webhook-secret");
  if (!providedSecret || !flow.webhookSecret) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  if (providedSecret.length !== flow.webhookSecret.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < providedSecret.length; i++) {
    mismatch |= providedSecret.charCodeAt(i) ^ flow.webhookSecret.charCodeAt(i);
  }
  return mismatch === 0;
}

// GET - Verify webhook is active (public - no secret needed)
export async function GET(request: Request, context: RouteContext) {
  try {
    const { webhookId } = await context.params;

    const flow = await getFlowByWebhookId(webhookId);

    if (!flow) {
      return NextResponse.json(
        { error: "Webhook not found or disabled" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: "active",
      flowId: flow.id,
      flowName: flow.name,
      deployedVersion: flow.deployedVersion,
    });
  } catch (error) {
    console.error("Webhook GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Handle conversation turn (requires authentication)
export async function POST(request: Request, context: RouteContext) {
  try {
    const { webhookId } = await context.params;

    // Get flow by webhook ID
    const flow = await getFlowByWebhookId(webhookId);

    if (!flow) {
      return NextResponse.json(
        { error: "Webhook not found or disabled" },
        { status: 404 }
      );
    }

    // Validate webhook secret
    if (!validateWebhookSecret(request, flow)) {
      return NextResponse.json(
        { error: "Unauthorized - invalid or missing webhook secret" },
        { status: 401 }
      );
    }

    const payload: WebhookPayload = await request.json();

    // Get the published version for execution
    const publishedVersion = await getPublishedFlowVersion(flow.id);
    const flowData = publishedVersion?.flowData || flow.flowData;

    // Initialize or continue conversation
    const sessionId = payload.sessionId || generateSessionId();
    const userInput = payload.userInput || payload.speechResult || "";
    const currentNodeId = payload.currentNodeId || findStartNode(flowData.nodes);
    const variables = payload.variables || initializeVariables(flowData.variables);
    const conversationHistory = payload.conversationHistory || [];

    // Update user input variable
    variables["user_input"] = userInput;

    // Execute current node using shared engine
    const result = await executeNode(
      flowData.nodes,
      flowData.edges,
      currentNodeId,
      userInput,
      variables,
      conversationHistory
    );

    // Log call event
    if (payload.callId) {
      await logCallEvent(payload.callId, "conversation_turn", {
        nodeId: currentNodeId,
        userInput,
        agentResponse: result.response,
        nextNodeId: result.nextNodeId,
      });
    }

    const response: WebhookResponse = {
      response: result.response,
      action: result.action,
      nextNodeId: result.nextNodeId,
      variables: result.variables,
      transferTo: result.transferTo,
      gatherOptions: {
        timeout: flowData.settings.timeout || 10000,
        speechModel: "nova-2",
      },
    };

    return NextResponse.json({
      sessionId,
      ...response,
      conversationHistory: [
        ...conversationHistory,
        ...(userInput ? [{ role: "user", content: userInput }] : []),
        { role: "assistant", content: result.response },
      ],
    });
  } catch (error) {
    console.error("Webhook POST error:", error);
    return NextResponse.json(
      {
        error: "Failed to process request",
        response: "I'm sorry, I encountered an error. Please try again.",
        action: "speak",
        nextNodeId: null,
      },
      { status: 500 }
    );
  }
}

// Generate session ID
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Log call event to database
async function logCallEvent(
  callId: string,
  eventType: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await query(
      `INSERT INTO call_events (call_id, event_type, metadata, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [callId, eventType, JSON.stringify(metadata)]
    );
  } catch (error) {
    console.error("Failed to log call event:", error);
  }
}
