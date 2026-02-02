/**
 * Voice Agent API Route
 *
 * Manages voice agent lifecycle for live calls.
 * POST /api/voice/agent - Start a voice agent in a room
 * GET  /api/voice/agent - Get active agent status
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { createFlowAgent, type FlowVoiceAgent } from "@/lib/voice/flow-agent";
import { generateRoomName, createRoom, generateToken, getServerUrl } from "@/lib/voice/livekit";
import { isVoiceConfigured } from "@/lib/voice/config";
import { getFlowById } from "@/services/flow.service";
import { query } from "@/lib/db";

// Track active agents in memory (for single-server deployment)
const activeAgents = new Map<string, { agent: FlowVoiceAgent; roomName: string; startedAt: Date }>();

// POST - Start a voice agent for a flow
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.organizationId) {
      return NextResponse.json({ error: "Organization required" }, { status: 400 });
    }

    if (!isVoiceConfigured()) {
      return NextResponse.json(
        { error: "Voice pipeline not configured. Add API keys to .env.local" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { flowId, roomName: providedRoomName } = body;

    if (!flowId) {
      return NextResponse.json({ error: "flowId is required" }, { status: 400 });
    }

    // Verify flow exists and belongs to org
    const flow = await getFlowById(flowId, user.organizationId);
    if (!flow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    // Generate room name and create room
    const roomName = providedRoomName || generateRoomName(user.organizationId);

    await createRoom({
      name: roomName,
      emptyTimeout: 300,
      maxParticipants: 2,
      metadata: JSON.stringify({
        organizationId: user.organizationId,
        flowId,
        flowName: flow.name,
        type: "voice_call",
      }),
    });

    // Create call record in DB
    const callResult = await query<{ id: string }>(
      `INSERT INTO calls (
        organization_id, flow_id, direction, caller_number, callee_number,
        status, started_at, metadata
      ) VALUES ($1, $2, 'inbound', 'browser', 'agent', 'initiated', NOW(), $3)
      RETURNING id`,
      [
        user.organizationId,
        flowId,
        JSON.stringify({ roomName, userId: user.id, type: "test_call" }),
      ]
    );

    const callId = callResult.rows[0]?.id;

    // Generate user token
    const userToken = await generateToken({
      roomName,
      participantName: user.name || user.email || "User",
      participantIdentity: `user_${user.id}`,
      isAgent: false,
      metadata: JSON.stringify({ userId: user.id }),
    });

    // Start the flow agent
    const agent = await createFlowAgent({
      roomName,
      webhookId: flow.webhookId,
      flowId: flow.id,
      agentName: `${flow.name} Agent`,
      callId,
      callerNumber: "browser",
      onTranscript: (speaker, text) => {
        console.log(`[${roomName}] ${speaker}: ${text}`);
      },
      onStateChange: (state) => {
        console.log(`[${roomName}] Agent state: ${state}`);
      },
      onCallEnd: async (summary) => {
        console.log(`[${roomName}] Call ended:`, {
          duration: summary.duration,
          turns: summary.turnCount,
          outcome: summary.outcome,
        });
        activeAgents.delete(roomName);
      },
      onError: (error) => {
        console.error(`[${roomName}] Agent error:`, error);
      },
    });

    activeAgents.set(roomName, { agent, roomName, startedAt: new Date() });

    // Update call status
    await query(
      `UPDATE calls SET status = 'in_progress', answered_at = NOW() WHERE id = $1`,
      [callId]
    );

    return NextResponse.json({
      roomName,
      callId,
      userToken,
      serverUrl: getServerUrl(),
      agentStatus: "connected",
      flow: {
        id: flow.id,
        name: flow.name,
      },
    });
  } catch (error) {
    console.error("Start agent error:", error);
    return NextResponse.json(
      { error: "Failed to start voice agent" },
      { status: 500 }
    );
  }
}

// GET - Get active agents status
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agents = Array.from(activeAgents.entries()).map(([roomName, data]) => ({
      roomName,
      state: data.agent.getState(),
      startedAt: data.startedAt,
      duration: Date.now() - data.startedAt.getTime(),
    }));

    return NextResponse.json({
      activeCount: agents.length,
      agents,
    });
  } catch (error) {
    console.error("Get agents error:", error);
    return NextResponse.json(
      { error: "Failed to get agent status" },
      { status: 500 }
    );
  }
}
