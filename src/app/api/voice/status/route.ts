/**
 * Call Status Webhook
 *
 * Receives status callbacks from Twilio and updates call records.
 * Also provides a GET endpoint to fetch current call status.
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";

// POST: Twilio status callback
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const callSid = formData.get("CallSid") as string;
    const callStatus = formData.get("CallStatus") as string;
    const callDuration = formData.get("CallDuration") as string;

    // Get callId from query params
    const { searchParams } = new URL(req.url);
    const callId = searchParams.get("callId");

    if (!callId) {
      console.error("[Status] Missing callId in callback");
      return new NextResponse("OK", { status: 200 });
    }

    console.log(`[Status] Call ${callId}: ${callStatus}`);

    // Map Twilio status to our status
    let status: string;
    switch (callStatus) {
      case "queued":
      case "initiated":
        status = "initiating";
        break;
      case "ringing":
        status = "ringing";
        break;
      case "in-progress":
        status = "in_progress";
        break;
      case "completed":
        status = "completed";
        break;
      case "busy":
      case "no-answer":
      case "failed":
      case "canceled":
        status = "failed";
        break;
      default:
        status = callStatus;
    }

    // Update call record
    const updates: string[] = [`status = '${status}'`];
    const params: unknown[] = [callId];

    if (status === "in_progress") {
      updates.push("answered_at = NOW()");
    }

    if (status === "completed" || status === "failed") {
      updates.push("ended_at = NOW()");
      if (callDuration) {
        updates.push(`duration_seconds = ${parseInt(callDuration)}`);
      }
    }

    await query(
      `UPDATE calls SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $1`,
      params
    );

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("[Status] Error processing callback:", error);
    return new NextResponse("OK", { status: 200 }); // Always return 200 to Twilio
  }
}

// GET: Fetch call status and transcript
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const callId = searchParams.get("callId");

    if (!callId) {
      return NextResponse.json({ error: "callId required" }, { status: 400 });
    }

    // Fetch call with events
    const callResult = await query(
      `SELECT c.id, c.status, c.direction, c.caller_number, c.callee_number,
              c.started_at, c.answered_at, c.ended_at, c.duration_seconds,
              c.transcript, c.metadata
       FROM calls c
       WHERE c.id = $1 AND c.organization_id = $2`,
      [callId, session.user.organizationId]
    );

    if (callResult.rows.length === 0) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const call = callResult.rows[0];

    // Fetch call events for live transcript
    const eventsResult = await query(
      `SELECT event_type, speaker, content, metadata, timestamp
       FROM call_events
       WHERE call_id = $1
       ORDER BY timestamp ASC`,
      [callId]
    );

    // Parse conversation turns from events
    const transcriptEntries = eventsResult.rows
      .filter((e) => e.event_type === "conversation_turn")
      .map((e) => {
        const meta = e.metadata || {};
        return {
          userInput: meta.userInput,
          agentResponse: meta.agentResponse,
          timestamp: e.timestamp,
        };
      });

    return NextResponse.json({
      call: {
        id: call.id,
        status: call.status,
        direction: call.direction,
        callerNumber: call.caller_number,
        calleeNumber: call.callee_number,
        startedAt: call.started_at,
        answeredAt: call.answered_at,
        endedAt: call.ended_at,
        durationSeconds: call.duration_seconds,
      },
      transcript: transcriptEntries,
      rawTranscript: call.transcript,
    });
  } catch (error) {
    console.error("[Status] Error fetching call:", error);
    return NextResponse.json(
      { error: "Failed to fetch call status" },
      { status: 500 }
    );
  }
}
