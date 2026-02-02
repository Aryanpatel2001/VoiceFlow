/**
 * Voice Pipeline Configuration
 *
 * Centralized configuration for all voice services.
 * Validates required environment variables on import.
 *
 * @module lib/voice/config
 */

export interface VoiceConfig {
  // LiveKit
  livekit: {
    apiKey: string;
    apiSecret: string;
    url: string;
  };
  // OpenAI
  openai: {
    apiKey: string;
    model: string;
    maxTokens: number;
  };
  // Deepgram
  deepgram: {
    apiKey: string;
    model: string;
    language: string;
  };
  // ElevenLabs
  elevenlabs: {
    apiKey: string;
    voiceId: string;
    model: string;
  };
}

/**
 * Default voice settings
 */
export const DEFAULT_VOICE_SETTINGS = {
  // OpenAI models
  openai: {
    model: "gpt-4o-mini", // Fast model for conversational AI
    modelComplex: "gpt-4o", // Complex queries
    maxTokens: 150, // Keep responses concise for voice
    temperature: 0.7,
  },
  // Deepgram settings
  deepgram: {
    model: "nova-2", // Latest fast model
    language: "en-US",
    punctuate: true,
    interimResults: true,
    utteranceEndMs: 1000,
    vadEvents: true,
  },
  // ElevenLabs settings
  elevenlabs: {
    model: "eleven_turbo_v2_5", // Lowest latency model
    voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel - clear, professional
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.0,
    useSpeakerBoost: true,
  },
  // LiveKit settings
  livekit: {
    roomPrefix: "vfp_", // VoiceFlow Pro room prefix
    tokenTtl: 3600, // 1 hour token validity
    maxParticipants: 2, // User + Agent
  },
};

/**
 * System prompts for different agent personas
 */
export const AGENT_PROMPTS = {
  default: `You are a helpful AI voice assistant for a business. Your role is to:
- Answer customer questions clearly and concisely
- Help schedule appointments when requested
- Provide information about services and pricing
- Transfer to a human when the customer requests it or when you cannot help

Keep your responses brief (1-2 sentences) since this is a voice conversation.
Be friendly, professional, and helpful. If you don't know something, say so honestly.`,

  receptionist: `You are Alex, an AI receptionist. Your job is to:
- Greet callers warmly
- Understand their reason for calling
- Schedule appointments if requested
- Answer basic questions about the business
- Take messages for staff members
- Transfer urgent calls to the right person

Always be professional but warm. Keep responses under 2 sentences when possible.`,

  sales: `You are a helpful sales assistant. Your job is to:
- Understand customer needs
- Explain products/services and their benefits
- Answer pricing questions
- Qualify leads by understanding budget and timeline
- Schedule follow-up calls or demos

Be enthusiastic but not pushy. Focus on solving the customer's problem.`,

  support: `You are a customer support agent. Your job is to:
- Listen to customer issues with empathy
- Troubleshoot common problems step by step
- Escalate complex issues to human agents
- Follow up to ensure the issue is resolved

Be patient and understanding. Acknowledge frustration when appropriate.`,
};

/**
 * Get voice configuration from environment
 * Throws if required variables are missing
 */
export function getVoiceConfig(): VoiceConfig {
  const missing: string[] = [];

  // Check required env vars
  if (!process.env.LIVEKIT_API_KEY) missing.push("LIVEKIT_API_KEY");
  if (!process.env.LIVEKIT_API_SECRET) missing.push("LIVEKIT_API_SECRET");
  if (!process.env.LIVEKIT_URL) missing.push("LIVEKIT_URL");
  if (!process.env.OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
  if (!process.env.DEEPGRAM_API_KEY) missing.push("DEEPGRAM_API_KEY");
  if (!process.env.ELEVENLABS_API_KEY) missing.push("ELEVENLABS_API_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for voice pipeline: ${missing.join(", ")}`
    );
  }

  return {
    livekit: {
      apiKey: process.env.LIVEKIT_API_KEY!,
      apiSecret: process.env.LIVEKIT_API_SECRET!,
      url: process.env.LIVEKIT_URL!,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
      model: DEFAULT_VOICE_SETTINGS.openai.model,
      maxTokens: DEFAULT_VOICE_SETTINGS.openai.maxTokens,
    },
    deepgram: {
      apiKey: process.env.DEEPGRAM_API_KEY!,
      model: DEFAULT_VOICE_SETTINGS.deepgram.model,
      language: DEFAULT_VOICE_SETTINGS.deepgram.language,
    },
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY!,
      voiceId:
        process.env.ELEVENLABS_VOICE_ID ||
        DEFAULT_VOICE_SETTINGS.elevenlabs.voiceId,
      model: DEFAULT_VOICE_SETTINGS.elevenlabs.model,
    },
  };
}

/**
 * Check if voice config is available (without throwing)
 */
export function isVoiceConfigured(): boolean {
  return !!(
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET &&
    process.env.LIVEKIT_URL &&
    process.env.OPENAI_API_KEY &&
    process.env.DEEPGRAM_API_KEY &&
    process.env.ELEVENLABS_API_KEY
  );
}
