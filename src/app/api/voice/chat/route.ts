/**
 * Voice Chat API Route
 *
 * Processes user speech text and returns AI response with optional audio.
 * POST /api/voice/chat
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { generateResponse, type Message } from "@/lib/voice/openai";
import { synthesizeSpeech } from "@/lib/voice/elevenlabs";
import { AGENT_PROMPTS } from "@/lib/voice/config";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { text, conversationHistory = [], includeAudio = false } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    console.log(`🎤 [API/voice/chat] User said: "${text}"`);

    // Build messages from conversation history
    const messages: Message[] = [
      ...conversationHistory.map((msg: { role: string; content: string }) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: text },
    ];

    // Generate AI response
    const response = await generateResponse(messages, {
      systemPrompt: AGENT_PROMPTS.receptionist,
      maxTokens: 150,
    });

    console.log(`🤖 [API/voice/chat] Agent response: "${response}"`);

    // Optionally generate audio
    let audioBase64: string | null = null;
    if (includeAudio && response) {
      try {
        const audioBuffer = await synthesizeSpeech(response);
        audioBase64 = audioBuffer.toString("base64");
        console.log(`🔊 [API/voice/chat] Audio generated (${audioBuffer.length} bytes)`);
      } catch (audioError) {
        console.error("Failed to generate audio:", audioError);
        // Continue without audio
      }
    }

    return NextResponse.json({
      response,
      audio: audioBase64,
      audioMimeType: "audio/mpeg",
    });
  } catch (error) {
    console.error("Voice chat error:", error);
    return NextResponse.json(
      { error: "Failed to process voice chat" },
      { status: 500 }
    );
  }
}
