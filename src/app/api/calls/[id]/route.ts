/**
 * Call Details API Route
 *
 * GET /api/calls/[id] - Get a single call with events
 * PATCH /api/calls/[id] - Update a call
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getCallWithEvents,
  updateCall,
  getCallById,
  type UpdateCallInput,
} from "@/services/call.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

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

    const { id: callId } = await context.params;

    const call = await getCallWithEvents(callId);

    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    // Verify call belongs to user's organization
    if (call.organization_id !== user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ call });
  } catch (error) {
    console.error("Get call error:", error);
    return NextResponse.json(
      { error: "Failed to fetch call" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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

    const { id: callId } = await context.params;

    // Check call exists and belongs to org
    const existingCall = await getCallById(callId);
    if (!existingCall) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    if (existingCall.organization_id !== user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Build update input from allowed fields
    const updates: UpdateCallInput = {};

    if (body.status !== undefined) updates.status = body.status;
    if (body.answeredAt !== undefined) updates.answeredAt = new Date(body.answeredAt);
    if (body.endedAt !== undefined) updates.endedAt = new Date(body.endedAt);
    if (body.durationSeconds !== undefined) updates.durationSeconds = body.durationSeconds;
    if (body.primaryIntent !== undefined) updates.primaryIntent = body.primaryIntent;
    if (body.intentConfidence !== undefined) updates.intentConfidence = body.intentConfidence;
    if (body.sentimentScore !== undefined) updates.sentimentScore = body.sentimentScore;
    if (body.sentimentLabel !== undefined) updates.sentimentLabel = body.sentimentLabel;
    if (body.outcome !== undefined) updates.outcome = body.outcome;
    if (body.outcomeDetails !== undefined) updates.outcomeDetails = body.outcomeDetails;
    if (body.recordingUrl !== undefined) updates.recordingUrl = body.recordingUrl;
    if (body.transcript !== undefined) updates.transcript = body.transcript;
    if (body.summary !== undefined) updates.summary = body.summary;
    if (body.metadata !== undefined) updates.metadata = body.metadata;

    const call = await updateCall(callId, updates);

    return NextResponse.json({ call });
  } catch (error) {
    console.error("Update call error:", error);
    return NextResponse.json(
      { error: "Failed to update call" },
      { status: 500 }
    );
  }
}
