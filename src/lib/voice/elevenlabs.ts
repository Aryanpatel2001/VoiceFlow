/**
 * ElevenLabs Text-to-Speech Service
 *
 * High-quality voice synthesis using ElevenLabs Turbo v2.5.
 * Optimized for low-latency real-time voice conversations.
 *
 * @module lib/voice/elevenlabs
 */

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { DEFAULT_VOICE_SETTINGS } from "./config";

// Types
export interface TTSOptions {
  voiceId?: string;
  model?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface Voice {
  voiceId: string;
  name: string;
  category: string;
  description?: string;
}

/**
 * Get ElevenLabs client singleton
 */
let elevenLabsClient: ElevenLabsClient | null = null;

function getClient(): ElevenLabsClient {
  if (!elevenLabsClient) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }
    elevenLabsClient = new ElevenLabsClient({ apiKey });
  }
  return elevenLabsClient;
}

/**
 * Synthesize text to speech
 * Returns audio as a Buffer (MP3 format)
 */
export async function synthesizeSpeech(
  text: string,
  options?: TTSOptions
): Promise<Buffer> {
  const client = getClient();

  const voiceId =
    options?.voiceId ||
    process.env.ELEVENLABS_VOICE_ID ||
    DEFAULT_VOICE_SETTINGS.elevenlabs.voiceId;

  const response = await client.textToSpeech.convert(voiceId, {
    text,
    modelId: options?.model || DEFAULT_VOICE_SETTINGS.elevenlabs.model,
    voiceSettings: {
      stability: options?.stability ?? DEFAULT_VOICE_SETTINGS.elevenlabs.stability,
      similarityBoost:
        options?.similarityBoost ??
        DEFAULT_VOICE_SETTINGS.elevenlabs.similarityBoost,
      style: options?.style ?? DEFAULT_VOICE_SETTINGS.elevenlabs.style,
      useSpeakerBoost:
        options?.useSpeakerBoost ??
        DEFAULT_VOICE_SETTINGS.elevenlabs.useSpeakerBoost,
    },
    outputFormat: "mp3_44100_128",
  });

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  const stream = response as unknown as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Stream text to speech
 * Returns an async generator that yields audio chunks
 * Useful for real-time playback while generating
 */
export async function* streamSpeech(
  text: string,
  options?: TTSOptions
): AsyncGenerator<Buffer> {
  // Fallback implementation: generate full audio once and yield as a single chunk
  const audioBuffer = await synthesizeSpeech(text, options);
  yield audioBuffer;
}

/**
 * Get available voices from ElevenLabs
 */
export async function getVoices(): Promise<Voice[]> {
  const client = getClient();

  const response = await client.voices.getAll();

  return (response.voices || []).map((voice) => ({
    voiceId: voice.voiceId || "",
    name: voice.name || "",
    category: voice.category || "unknown",
    description: voice.description,
  }));
}

/**
 * Popular preset voices for quick selection
 */
export const PRESET_VOICES = {
  rachel: {
    id: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel",
    description: "Calm, professional female voice",
  },
  drew: {
    id: "29vD33N1CtxCmqQRPOHJ",
    name: "Drew",
    description: "Warm, friendly male voice",
  },
  clyde: {
    id: "2EiwWnXFnvU5JabPnv8n",
    name: "Clyde",
    description: "Confident, authoritative male voice",
  },
  sarah: {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Sarah",
    description: "Soft, approachable female voice",
  },
  charlie: {
    id: "IKne3meq5aSn9XLyUdCD",
    name: "Charlie",
    description: "Casual, conversational male voice",
  },
  emily: {
    id: "LcfcDJNUP1GQjkzn1xUU",
    name: "Emily",
    description: "Energetic, upbeat female voice",
  },
  fin: {
    id: "D38z5RcWu1voky8WS1ja",
    name: "Fin",
    description: "Professional Irish male voice",
  },
  freya: {
    id: "jsCqWAovK2LkecY7zXl4",
    name: "Freya",
    description: "Clear, articulate female voice",
  },
};

/**
 * Synthesize text to PCM audio for LiveKit streaming
 * Returns raw PCM buffer (16-bit signed, mono)
 */
export async function synthesizeSpeechPCM(
  text: string,
  options?: TTSOptions & { sampleRate?: number }
): Promise<{ buffer: Buffer; sampleRate: number }> {
  const client = getClient();
  const sampleRate = options?.sampleRate || 24000;

  const voiceId =
    options?.voiceId ||
    process.env.ELEVENLABS_VOICE_ID ||
    DEFAULT_VOICE_SETTINGS.elevenlabs.voiceId;

  // Map sample rate to ElevenLabs output format
  const formatMap: Record<number, string> = {
    16000: "pcm_16000",
    22050: "pcm_22050",
    24000: "pcm_24000",
    44100: "pcm_44100",
  };
  const outputFormat = formatMap[sampleRate] || "pcm_24000";

  const response = await client.textToSpeech.convert(voiceId, {
    text,
    modelId: options?.model || DEFAULT_VOICE_SETTINGS.elevenlabs.model,
    voiceSettings: {
      stability: options?.stability ?? DEFAULT_VOICE_SETTINGS.elevenlabs.stability,
      similarityBoost:
        options?.similarityBoost ??
        DEFAULT_VOICE_SETTINGS.elevenlabs.similarityBoost,
      style: options?.style ?? DEFAULT_VOICE_SETTINGS.elevenlabs.style,
      useSpeakerBoost:
        options?.useSpeakerBoost ??
        DEFAULT_VOICE_SETTINGS.elevenlabs.useSpeakerBoost,
    },
    outputFormat: outputFormat as "pcm_16000" | "pcm_22050" | "pcm_24000" | "pcm_44100",
  });

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  const stream = response as unknown as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return { buffer: Buffer.concat(chunks), sampleRate };
}

/**
 * Synthesize text to μ-law audio for Twilio Media Streams
 * Returns raw μ-law buffer (8kHz, mono) - Twilio's native format
 */
export async function synthesizeSpeechMulaw(
  text: string,
  options?: TTSOptions
): Promise<Buffer> {
  console.log(`[ElevenLabs] synthesizeSpeechMulaw called for text: "${text.substring(0, 50)}..."`);

  const client = getClient();

  const voiceId =
    options?.voiceId ||
    process.env.ELEVENLABS_VOICE_ID ||
    DEFAULT_VOICE_SETTINGS.elevenlabs.voiceId;

  console.log(`[ElevenLabs] Using voice: ${voiceId}, model: ${DEFAULT_VOICE_SETTINGS.elevenlabs.model}`);

  try {
    const response = await client.textToSpeech.convert(voiceId, {
      text,
      modelId: options?.model || DEFAULT_VOICE_SETTINGS.elevenlabs.model,
      voiceSettings: {
        stability: options?.stability ?? DEFAULT_VOICE_SETTINGS.elevenlabs.stability,
        similarityBoost:
          options?.similarityBoost ??
          DEFAULT_VOICE_SETTINGS.elevenlabs.similarityBoost,
        style: options?.style ?? DEFAULT_VOICE_SETTINGS.elevenlabs.style,
        useSpeakerBoost:
          options?.useSpeakerBoost ??
          DEFAULT_VOICE_SETTINGS.elevenlabs.useSpeakerBoost,
      },
      outputFormat: "ulaw_8000",
    });

    console.log(`[ElevenLabs] Got response, collecting audio chunks...`);

    const chunks: Uint8Array[] = [];
    const stream = response as unknown as AsyncIterable<Uint8Array>;
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    console.log(`[ElevenLabs] Audio buffer ready: ${buffer.length} bytes (${(buffer.length / 8000).toFixed(2)}s at 8kHz)`);
    return buffer;
  } catch (error) {
    console.error(`[ElevenLabs] TTS error:`, error);
    throw error;
  }
}

/**
 * Convert PCM audio to format suitable for TTS input
 * ElevenLabs accepts text, but this helper is useful for
 * audio-to-audio pipelines where you might need format conversion
 */
export function audioBufferToBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}
