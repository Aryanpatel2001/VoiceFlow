/**
 * Twilio Voice Webhook Handler
 *
 * Handles incoming voice calls from Twilio using Media Streams.
 * Opens a WebSocket for real-time bidirectional audio:
 *   Caller audio → Deepgram STT (streaming) → OpenAI → ElevenLabs TTS → Caller hears
 *
 * POST /api/voice/twilio - Handle incoming call (returns <Connect><Stream> TwiML)
 * POST /api/voice/twilio?action=status - Handle status callback
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";

interface TwilioParams {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: string;
  Direction: string;
  SpeechResult?: string;
}

// POST - Handle incoming Twilio call
export async function POST(request: Request) {
  console.log(`[TwiML] POST request received`);

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    console.log(`[TwiML] URL: ${url.pathname}${url.search}`);
    console.log(`[TwiML] Action: ${action || 'none (handle call)'}`);

    // Parse Twilio form data
    const formData = await request.formData();
    const params: TwilioParams = {
      CallSid: formData.get("CallSid") as string || "",
      AccountSid: formData.get("AccountSid") as string || "",
      From: formData.get("From") as string || "",
      To: formData.get("To") as string || "",
      CallStatus: formData.get("CallStatus") as string || "",
      Direction: formData.get("Direction") as string || "",
      SpeechResult: formData.get("SpeechResult") as string || undefined,
    };

    console.log(`[TwiML] Params: CallSid=${params.CallSid}, From=${params.From}, To=${params.To}`);

    if (action === "status") {
      return handleStatusCallback(params);
    }

    // Initial incoming call → start media stream
    return handleIncomingCall(params, url);
  } catch (error) {
    console.error("[TwiML] Twilio webhook error:", error);
    return new Response(
      generateTwiml(`<Say>We're sorry, an error occurred. Please try again later.</Say><Hangup/>`),
      { headers: { "Content-Type": "text/xml" } }
    );
  }
}

/**
 * Handle initial call (inbound or outbound).
 * Returns TwiML that opens a WebSocket Media Stream for real-time audio.
 */
async function handleIncomingCall(params: TwilioParams, requestUrl: URL): Promise<Response> {
  // Check for outbound call params (passed by /api/voice/outbound)
  const direction = requestUrl.searchParams.get("direction");
  const providedCallId = requestUrl.searchParams.get("callId");
  const providedWebhookId = requestUrl.searchParams.get("webhookId");

  const isOutbound = direction === "outbound" && providedCallId && providedWebhookId;

  if (isOutbound) {
    console.log(`Outbound call: ${params.From} -> ${params.To} (${params.CallSid})`);
  } else {
    console.log(`Inbound call: ${params.From} -> ${params.To} (${params.CallSid})`);
  }

  let callId: string;
  let webhookId: string;
  let callerNumber: string;
  let calleeNumber: string;

  if (isOutbound) {
    // Outbound call - use provided callId and webhookId
    callId = providedCallId;
    webhookId = providedWebhookId;
    callerNumber = params.From; // Twilio number
    calleeNumber = params.To;   // Destination

    console.log(`[TwiML] Outbound call - callId: ${callId}, webhookId: ${webhookId}`);

    // Update call record with Twilio's call SID and set status
    try {
      await query(
        `UPDATE calls SET provider_call_id = $1, status = 'in_progress', answered_at = NOW()
         WHERE id = $2`,
        [params.CallSid, callId]
      );
      console.log(`[TwiML] Updated call record for ${callId}`);
    } catch (err) {
      console.error(`[TwiML] Failed to update call record:`, err);
      // Continue anyway - don't fail the TwiML response
    }
  } else {
    // Inbound call - find phone number and assigned flow
    // For inbound, params.To is our Twilio number
    const phoneResult = await query<{
      id: string;
      organization_id: string;
      assigned_flow_id: string | null;
    }>(
      `SELECT id, organization_id, assigned_flow_id FROM phone_numbers
       WHERE number = $1 AND status = 'active'`,
      [params.To]
    );

    if (phoneResult.rows.length === 0) {
      console.error(`Phone number not found: ${params.To}`);
      return new Response(
        generateTwiml(`<Say>This number is not configured. Goodbye.</Say><Hangup/>`),
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    const phoneNumber = phoneResult.rows[0];

    if (!phoneNumber.assigned_flow_id) {
      return new Response(
        generateTwiml(`<Say>This number does not have an active voice agent. Goodbye.</Say><Hangup/>`),
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Get the flow and its webhook endpoint
    const flowResult = await query<{
      id: string;
      name: string;
      webhook_id: string | null;
      status: string;
      endpoint_enabled: boolean;
    }>(
      `SELECT id, name, webhook_id, status, endpoint_enabled FROM flows
       WHERE id = $1 AND organization_id = $2`,
      [phoneNumber.assigned_flow_id, phoneNumber.organization_id]
    );

    if (flowResult.rows.length === 0 || !flowResult.rows[0].webhook_id) {
      return new Response(
        generateTwiml(`<Say>The assigned flow is not published. Goodbye.</Say><Hangup/>`),
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    const flow = flowResult.rows[0];
    webhookId = flow.webhook_id!;
    callerNumber = params.From;
    calleeNumber = params.To;

    // Create call record for inbound
    const callResult = await query<{ id: string }>(
      `INSERT INTO calls (
        organization_id, flow_id, phone_number_id, direction,
        caller_number, callee_number, status, started_at,
        provider, provider_call_id, metadata
      ) VALUES ($1, $2, $3, 'inbound', $4, $5, 'in_progress', NOW(), 'twilio', $6, $7)
      RETURNING id`,
      [
        phoneNumber.organization_id,
        flow.id,
        phoneNumber.id,
        params.From,
        params.To,
        params.CallSid,
        JSON.stringify({ twilioCallSid: params.CallSid }),
      ]
    );

    callId = callResult.rows[0]?.id;
  }

  // Build WebSocket URL for Media Stream
  const baseUrl = process.env.NEXTAUTH_URL || `${requestUrl.protocol}//${requestUrl.host}`;
  const wsProtocol = baseUrl.startsWith("https") ? "wss" : "ws";
  const wsHost = baseUrl.replace(/^https?:\/\//, "");
  const streamUrl = `${wsProtocol}://${wsHost}/api/voice/twilio-stream?callId=${callId}&webhookId=${webhookId}&callerNumber=${encodeURIComponent(callerNumber)}&calleeNumber=${encodeURIComponent(calleeNumber)}`;

  const statusUrl = `${baseUrl}/api/voice/twilio?action=status`;

  console.log(`Starting media stream for call ${callId}`);
  console.log(`Stream URL: ${streamUrl}`);

  // Build simpler WebSocket URL (params passed via <Parameter>)
  const simpleStreamUrl = `${wsProtocol}://${wsHost}/api/voice/twilio-stream`;

  // Return TwiML that opens a bidirectional media stream
  // Use <Parameter> elements to pass custom data (available in start event's customParameters)
  const twiml = generateTwiml(`
    <Connect>
      <Stream url="${escapeXml(simpleStreamUrl)}">
        <Parameter name="callId" value="${escapeXml(callId)}" />
        <Parameter name="webhookId" value="${escapeXml(webhookId)}" />
        <Parameter name="callerNumber" value="${escapeXml(callerNumber)}" />
        <Parameter name="calleeNumber" value="${escapeXml(calleeNumber)}" />
      </Stream>
    </Connect>
  `);

  console.log(`TwiML Response:\n${twiml}`);

  return new Response(
    twiml,
    {
      headers: {
        "Content-Type": "text/xml",
        "X-Twilio-Status-Callback": statusUrl,
      },
    }
  );
}

/**
 * Handle status callback
 */
async function handleStatusCallback(params: TwilioParams): Promise<Response> {
  console.log(`Call status update: ${params.CallSid} -> ${params.CallStatus}`);

  if (params.CallStatus === "completed" || params.CallStatus === "failed" || params.CallStatus === "no-answer") {
    await query(
      `UPDATE calls SET
        status = $1,
        ended_at = NOW(),
        duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::int
       WHERE provider_call_id = $2`,
      [params.CallStatus === "completed" ? "completed" : "failed", params.CallSid]
    );
  }

  return NextResponse.json({ received: true });
}

/**
 * Generate TwiML response wrapper
 */
function generateTwiml(content: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>${content}</Response>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
