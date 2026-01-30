/**
 * OpenAI LLM Service
 *
 * Conversational AI using GPT-4o-mini for fast responses.
 * Optimized for voice conversations with concise outputs.
 *
 * @module lib/voice/openai
 */

import OpenAI from "openai";
import { DEFAULT_VOICE_SETTINGS, AGENT_PROMPTS } from "./config";

// Types
export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface StreamChunk {
  content: string;
  isComplete: boolean;
}

/**
 * Get OpenAI client singleton
 */
let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Generate a response from the conversation history
 * Non-streaming version for simple use cases
 */
export async function generateResponse(
  messages: Message[],
  options?: GenerateOptions
): Promise<string> {
  const client = getClient();

  const systemPrompt = options?.systemPrompt || AGENT_PROMPTS.default;

  const allMessages: Message[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const response = await client.chat.completions.create({
    model: options?.model || DEFAULT_VOICE_SETTINGS.openai.model,
    messages: allMessages,
    max_tokens: options?.maxTokens || DEFAULT_VOICE_SETTINGS.openai.maxTokens,
    temperature: options?.temperature || DEFAULT_VOICE_SETTINGS.openai.temperature,
  });

  return response.choices[0]?.message?.content || "";
}

/**
 * Stream a response from the conversation history
 * Returns an async generator that yields content chunks
 */
export async function* streamResponse(
  messages: Message[],
  options?: GenerateOptions
): AsyncGenerator<StreamChunk> {
  const client = getClient();

  const systemPrompt = options?.systemPrompt || AGENT_PROMPTS.default;

  const allMessages: Message[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const stream = await client.chat.completions.create({
    model: options?.model || DEFAULT_VOICE_SETTINGS.openai.model,
    messages: allMessages,
    max_tokens: options?.maxTokens || DEFAULT_VOICE_SETTINGS.openai.maxTokens,
    temperature: options?.temperature || DEFAULT_VOICE_SETTINGS.openai.temperature,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    const isComplete = chunk.choices[0]?.finish_reason !== null;

    if (content || isComplete) {
      yield { content, isComplete };
    }
  }
}

/**
 * Stream response and collect sentences for TTS
 * Yields complete sentences as they're formed
 * This enables starting TTS while still generating
 */
export async function* streamSentences(
  messages: Message[],
  options?: GenerateOptions
): AsyncGenerator<string> {
  let buffer = "";
  const sentenceEnders = /[.!?]\s*/;

  for await (const chunk of streamResponse(messages, options)) {
    buffer += chunk.content;

    // Check for complete sentences
    const sentences = buffer.split(sentenceEnders);

    // Yield all complete sentences except the last (possibly incomplete) one
    while (sentences.length > 1) {
      const sentence = sentences.shift()!.trim();
      if (sentence) {
        yield sentence;
      }
    }

    // Keep the last part in buffer
    buffer = sentences[0] || "";

    // If generation is complete, yield remaining buffer
    if (chunk.isComplete && buffer.trim()) {
      yield buffer.trim();
      buffer = "";
    }
  }
}

/**
 * Detect user intent from their message
 * Used for routing to appropriate handlers
 */
export async function detectIntent(
  userMessage: string
): Promise<{
  intent: string;
  confidence: number;
  entities: Record<string, string>;
}> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Analyze the user's message and extract the intent. Return JSON only.
Possible intents: greeting, booking, inquiry, support, complaint, transfer, goodbye, other
Also extract any relevant entities (name, date, time, service, phone, etc.)

Format: {"intent": "...", "confidence": 0.0-1.0, "entities": {...}}`,
      },
      { role: "user", content: userMessage },
    ],
    max_tokens: 150,
    temperature: 0,
    response_format: { type: "json_object" },
  });

  try {
    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    return {
      intent: result.intent || "other",
      confidence: result.confidence || 0.5,
      entities: result.entities || {},
    };
  } catch {
    return { intent: "other", confidence: 0.5, entities: {} };
  }
}

/**
 * Analyze sentiment/emotion from user message
 * Used for adaptive responses
 */
export async function analyzeSentiment(
  userMessage: string
): Promise<{
  sentiment: "positive" | "neutral" | "negative";
  emotion: string;
  urgency: number;
}> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Analyze the emotional state of the speaker. Return JSON only.
sentiment: positive, neutral, or negative
emotion: happy, frustrated, confused, angry, anxious, calm, etc.
urgency: 0.0-1.0 (how urgent their need seems)

Format: {"sentiment": "...", "emotion": "...", "urgency": 0.0-1.0}`,
      },
      { role: "user", content: userMessage },
    ],
    max_tokens: 100,
    temperature: 0,
    response_format: { type: "json_object" },
  });

  try {
    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    return {
      sentiment: result.sentiment || "neutral",
      emotion: result.emotion || "calm",
      urgency: result.urgency || 0.5,
    };
  } catch {
    return { sentiment: "neutral", emotion: "calm", urgency: 0.5 };
  }
}

/**
 * Build conversation context from call history
 */
export function buildConversationMessages(
  transcript: Array<{ speaker: "user" | "agent"; text: string }>
): Message[] {
  return transcript.map((entry) => ({
    role: entry.speaker === "user" ? "user" : "assistant",
    content: entry.text,
  }));
}
