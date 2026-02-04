/**
 * Voice Token API Route
 *
 * Generates LiveKit tokens for browser-based test calls.
 * POST /api/voice/token
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  generateToken,
  createRoom,
  getRoom,
  generateRoomName,
  getServerUrl,
} from "@/lib/voice/livekit";
import { isVoiceConfigured } from "@/lib/voice/config";

export async function POST(request: Request) {
  try {
    // Check auth
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

    // Check if voice is configured
    if (!isVoiceConfigured()) {
      return NextResponse.json(
        { error: "Voice pipeline is not configured. Please add API keys to .env.local" },
        { status: 503 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { roomName: providedRoomName } = body;

    // Generate or use provided room name
    const roomName = providedRoomName || generateRoomName(user.organizationId);
    console.log("🎙️ [API/voice/token] Creating room:", roomName);

    // Check if room exists, create if not
    let room = await getRoom(roomName);
    if (!room) {
      console.log("📦 [API/voice/token] Room doesn't exist, creating new room...");
      room = await createRoom({
        name: roomName,
        emptyTimeout: 300, // 5 minutes
        maxParticipants: 2, // User + Agent
        metadata: JSON.stringify({
          organizationId: user.organizationId,
          createdBy: user.id,
          type: "test_call",
        }),
      });
    }

    // Generate token for the user
    const token = await generateToken({
      roomName,
      participantName: user.name || user.email || "User",
      participantIdentity: `user_${user.id}`,
      isAgent: false,
      metadata: JSON.stringify({
        userId: user.id,
        organizationId: user.organizationId,
      }),
    });

    console.log("✅ [API/voice/token] Token generated for user:", user.email);
    console.log("🔗 [API/voice/token] Room:", roomName);

    return NextResponse.json({
      token,
      roomName,
      serverUrl: getServerUrl(),
      room: {
        name: room.name,
        sid: room.sid,
        numParticipants: room.numParticipants,
      },
    });
  } catch (error) {
    console.error("Voice token error:", error);
    return NextResponse.json(
      { error: "Failed to generate voice token" },
      { status: 500 }
    );
  }
}
