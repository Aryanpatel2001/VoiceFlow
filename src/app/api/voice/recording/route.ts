/**
 * Recording Callback API
 *
 * Receives recording status callbacks from Twilio and updates call records.
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { applyRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // Rate limiting - webhook operations
    const rateLimitResponse = applyRateLimit(req, "webhook", "voice/recording");
    if (rateLimitResponse) return rateLimitResponse;

    const formData = await req.formData();

    // Twilio recording callback parameters
    const recordingSid = formData.get("RecordingSid") as string;
    const recordingUrl = formData.get("RecordingUrl") as string;
    const recordingStatus = formData.get("RecordingStatus") as string;
    const recordingDuration = formData.get("RecordingDuration") as string;
    const callSid = formData.get("CallSid") as string;

    // Get callId from query params
    const { searchParams } = new URL(req.url);
    const callId = searchParams.get("callId");

    if (!callId) {
      console.error("[Recording] Missing callId in callback");
      return new NextResponse("OK", { status: 200 });
    }

    console.log(`[Recording] Call ${callId}: status=${recordingStatus}, duration=${recordingDuration}s`);

    // Only process completed recordings
    if (recordingStatus !== "completed") {
      return new NextResponse("OK", { status: 200 });
    }

    // Build the full recording URL with authentication
    // Twilio recordings are accessible via the API with .mp3 or .wav extension
    const fullRecordingUrl = recordingUrl ? `${recordingUrl}.mp3` : null;

    // Update call record with recording information
    const duration = recordingDuration ? parseInt(recordingDuration, 10) : null;

    await query(
      `UPDATE calls SET
        recording_url = $1,
        recording_duration_seconds = $2,
        updated_at = NOW()
       WHERE id = $3`,
      [fullRecordingUrl, duration, callId]
    );

    // Log recording event
    await query(
      `INSERT INTO call_events (call_id, event_type, content, metadata)
       VALUES ($1, 'recording_completed', 'Call recording completed', $2)`,
      [
        callId,
        JSON.stringify({
          recordingSid,
          recordingUrl: fullRecordingUrl,
          durationSeconds: duration,
          callSid,
        }),
      ]
    );

    console.log(`[Recording] Saved recording for call ${callId}: ${fullRecordingUrl}`);

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("[Recording] Error processing callback:", error);
    return new NextResponse("OK", { status: 200 }); // Always return 200 to Twilio
  }
}

/**
 * GET endpoint to fetch recording URL for a call
 */
export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = applyRateLimit(req, "read", "voice/recording");
    if (rateLimitResponse) return rateLimitResponse;

    const { searchParams } = new URL(req.url);
    const callId = searchParams.get("callId");

    if (!callId) {
      return NextResponse.json(
        { error: "callId is required" },
        { status: 400 }
      );
    }

    const result = await query(
      `SELECT recording_url, recording_duration_seconds
       FROM calls WHERE id = $1`,
      [callId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Call not found" },
        { status: 404 }
      );
    }

    const call = result.rows[0];

    if (!call.recording_url) {
      return NextResponse.json(
        { error: "No recording available for this call" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      recordingUrl: call.recording_url,
      durationSeconds: call.recording_duration_seconds,
    });
  } catch (error) {
    console.error("[Recording] Error fetching recording:", error);
    return NextResponse.json(
      { error: "Failed to fetch recording" },
      { status: 500 }
    );
  }
}
