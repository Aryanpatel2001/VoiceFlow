/**
 * Call Hangup API
 *
 * Terminates an active Twilio call.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { applyRateLimit } from "@/lib/rate-limit";
import { query } from "@/lib/db";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = applyRateLimit(req, "write", "voice/hangup");
    if (rateLimitResponse) return rateLimitResponse;

    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { callId } = body;

    if (!callId) {
      return NextResponse.json(
        { error: "callId is required" },
        { status: 400 }
      );
    }

    // Get call details and verify ownership
    const callResult = await query(
      `SELECT id, provider_call_id, status, organization_id
       FROM calls
       WHERE id = $1`,
      [callId]
    );

    if (callResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Call not found" },
        { status: 404 }
      );
    }

    const call = callResult.rows[0];

    // Verify organization ownership
    if (call.organization_id !== session.user.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Check if call is still active
    const activeStatuses = ["initiating", "initiated", "ringing", "in_progress"];
    if (!activeStatuses.includes(call.status)) {
      return NextResponse.json({
        success: true,
        message: "Call already ended",
        status: call.status,
      });
    }

    // Terminate the Twilio call
    if (call.provider_call_id) {
      try {
        await twilioClient.calls(call.provider_call_id).update({
          status: "completed",
        });
        console.log(`[Hangup] Terminated Twilio call: ${call.provider_call_id}`);
      } catch (twilioError) {
        console.error("[Hangup] Twilio error:", twilioError);
        // Continue to update our database even if Twilio fails
      }
    }

    // Update call status in database
    await query(
      `UPDATE calls SET
        status = 'completed',
        ended_at = NOW(),
        duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::int,
        updated_at = NOW()
       WHERE id = $1`,
      [callId]
    );

    // Log the hangup event
    await query(
      `INSERT INTO call_events (call_id, event_type, content, metadata)
       VALUES ($1, 'hangup', 'Call ended by user', $2)`,
      [callId, JSON.stringify({ initiatedBy: "user", userId: session.user.id })]
    );

    return NextResponse.json({
      success: true,
      message: "Call terminated",
    });
  } catch (error) {
    console.error("[Hangup] Error:", error);
    return NextResponse.json(
      { error: "Failed to end call" },
      { status: 500 }
    );
  }
}
