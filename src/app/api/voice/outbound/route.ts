/**
 * Outbound Call API
 *
 * Initiates an outbound call from a Twilio number to a destination number.
 * Used for testing voice agents with real phone calls.
 */

import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { v4 as uuid } from "uuid";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { fromNumber, toNumber, flowId } = body;

    // Validate inputs
    if (!fromNumber || !toNumber) {
      return NextResponse.json(
        { error: "fromNumber and toNumber are required" },
        { status: 400 }
      );
    }

    // Verify the from number belongs to this organization
    const phoneResult = await query(
      `SELECT id, number, assigned_flow_id FROM phone_numbers
       WHERE number = $1 AND organization_id = $2`,
      [fromNumber, session.user.organizationId]
    );

    if (phoneResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Phone number not found or not authorized" },
        { status: 403 }
      );
    }

    const phoneNumber = phoneResult.rows[0];
    const effectiveFlowId = flowId || phoneNumber.assigned_flow_id;

    if (!effectiveFlowId) {
      return NextResponse.json(
        { error: "No flow assigned to this phone number" },
        { status: 400 }
      );
    }

    // Get the flow's webhook ID
    const flowResult = await query(
      `SELECT id, webhook_id FROM flows WHERE id = $1 AND organization_id = $2`,
      [effectiveFlowId, session.user.organizationId]
    );

    if (flowResult.rows.length === 0 || !flowResult.rows[0].webhook_id) {
      return NextResponse.json(
        { error: "Flow not found or not published" },
        { status: 400 }
      );
    }

    const webhookId = flowResult.rows[0].webhook_id;

    // Create call record
    const callId = uuid();
    await query(
      `INSERT INTO calls (
        id, organization_id, flow_id, phone_number_id,
        direction, caller_number, callee_number, status, started_at,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)`,
      [
        callId,
        session.user.organizationId,
        effectiveFlowId,
        phoneNumber.id,
        "outbound",
        fromNumber,
        toNumber,
        "initiating",
        JSON.stringify({ isTestCall: true, initiatedBy: session.user.id }),
      ]
    );

    // Initialize Twilio client
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return NextResponse.json(
        { error: "Twilio credentials not configured" },
        { status: 500 }
      );
    }

    const client = twilio(accountSid, authToken);

    // Build the TwiML URL with parameters
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const twimlUrl = `${baseUrl}/api/voice/twilio?webhookId=${webhookId}&callId=${callId}&direction=outbound`;
    const statusUrl = `${baseUrl}/api/voice/status?callId=${callId}`;

    console.log(`[Outbound] Base URL: ${baseUrl}`);
    console.log(`[Outbound] TwiML URL: ${twimlUrl}`);
    console.log(`[Outbound] Status URL: ${statusUrl}`);

    // Initiate the outbound call
    const call = await client.calls.create({
      to: toNumber,
      from: fromNumber,
      url: twimlUrl,
      statusCallback: statusUrl,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
    });

    // Update call record with Twilio's call SID
    await query(
      `UPDATE calls SET provider_call_id = $1, status = 'ringing' WHERE id = $2`,
      [call.sid, callId]
    );

    console.log(`[Outbound] Call initiated: ${callId} -> ${toNumber}`);

    return NextResponse.json({
      success: true,
      callId,
      twilioCallSid: call.sid,
      status: "ringing",
    });
  } catch (error) {
    console.error("[Outbound] Error initiating call:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to initiate call" },
      { status: 500 }
    );
  }
}
