/**
 * Test Call API Route
 *
 * POST /api/calls/test - Save a completed test call with transcript
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { createCall, updateCall, createCallEvent } from "@/services/call.service";

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
    const { duration, transcript, summary } = body;

    // Create call record
    const call = await createCall({
      organizationId: user.organizationId,
      direction: "inbound",
      callerNumber: "browser",
      calleeNumber: "ai-agent",
      metadata: { type: "test_call", userId: user.id },
    });

    // Save transcript events
    if (transcript && Array.isArray(transcript)) {
      for (const entry of transcript) {
        await createCallEvent({
          callId: call.id,
          eventType: "transcript",
          speaker: entry.speaker === "user" ? "caller" : "ai",
          content: entry.text,
        });
      }
    }

    // Build full transcript text
    const transcriptText = transcript
      ?.map((e: { speaker: string; text: string }) =>
        `${e.speaker === "user" ? "User" : "Agent"}: ${e.text}`
      )
      .join("\n") || null;

    // Add connected and ended events
    await createCallEvent({
      callId: call.id,
      eventType: "connected",
      speaker: "system",
      content: "Test call started from browser",
    });

    await createCallEvent({
      callId: call.id,
      eventType: "ended",
      speaker: "system",
      content: "Test call ended",
    });

    // Update call with final data
    await updateCall(call.id, {
      status: "completed",
      answeredAt: new Date(Date.now() - (duration || 0) * 1000),
      endedAt: new Date(),
      durationSeconds: duration || 0,
      transcript: transcriptText,
      summary: summary || null,
      outcome: "completed",
      outcomeDetails: "Browser test call",
    });

    return NextResponse.json({ callId: call.id }, { status: 201 });
  } catch (error) {
    console.error("Save test call error:", error);
    return NextResponse.json(
      { error: "Failed to save test call" },
      { status: 500 }
    );
  }
}
