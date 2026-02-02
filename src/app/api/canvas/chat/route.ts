/**
 * Smart Canvas Chat API Route
 *
 * Processes user messages with intelligent intent detection and entity extraction.
 * Uses OpenAI with structured output for reliable parsing.
 *
 * POST /api/canvas/chat
 */

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthenticatedUser } from "@/lib/auth";

// Local types for intent/entity detection (used only by this API route)
interface IntentDefinition {
  name: string;
  description: string;
  examples: string[];
}

interface EntityDefinition {
  name: string;
  type: string;
  description: string;
  required?: boolean;
}

interface ChatRequest {
  message: string;
  systemPrompt: string;
  instructions?: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  variables?: Record<string, unknown>;
  intents?: IntentDefinition[];
  entities?: EntityDefinition[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

interface StructuredResponse {
  response: string;
  intent: {
    name: string;
    confidence: number;
  };
  extractedEntities: Record<string, unknown>;
  nextAction: "continue" | "transfer" | "end_call" | "escalate";
  shouldWaitForInput: boolean;
}

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

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ChatRequest = await request.json();
    const {
      message,
      systemPrompt,
      instructions,
      conversationHistory = [],
      variables = {},
      intents = [],
      entities = [],
      temperature = 0.7,
      maxTokens = 300,
      model = "gpt-4o-mini",
    } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const client = getClient();

    // Build the enhanced system prompt
    let enhancedPrompt = systemPrompt || "You are a helpful AI voice assistant.";

    if (instructions) {
      enhancedPrompt += `\n\n## Instructions:\n${instructions}`;
    }

    // Add intent detection instructions
    if (intents.length > 0) {
      const intentsList = intents
        .map((i) => {
          const examples = i.examples.length > 0
            ? ` (examples: "${i.examples.slice(0, 3).join('", "')}")`
            : "";
          return `- ${i.name}: ${i.description}${examples}`;
        })
        .join("\n");
      enhancedPrompt += `\n\n## Intent Detection:\nClassify the user's message into one of these intents:\n${intentsList}\n\nIf no intent matches clearly, use "unknown".`;
    }

    // Add entity extraction instructions
    if (entities.length > 0) {
      const entitiesList = entities
        .map((e) => `- ${e.name} (${e.type}): ${e.description}${e.required ? " [REQUIRED]" : ""}`)
        .join("\n");
      enhancedPrompt += `\n\n## Entity Extraction:\nExtract these entities from the conversation if mentioned:\n${entitiesList}`;
    }

    // Add context variables
    if (Object.keys(variables).length > 0) {
      const relevantVars = Object.entries(variables)
        .filter(([, value]) => value !== null && value !== undefined && value !== "" && value !== 0)
        .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
        .join("\n");

      if (relevantVars) {
        enhancedPrompt += `\n\n## Current Context:\n${relevantVars}`;
      }
    }

    // Add response format instructions
    enhancedPrompt += `\n\n## Response Guidelines:
- Keep responses concise and natural for voice conversation
- Be helpful and friendly
- If you need more information, ask a clear question
- Determine if the conversation should continue, transfer to human, or end`;

    // Build messages
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: enhancedPrompt },
      ...conversationHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    console.log(`🧠 [Canvas/Chat] Processing: "${message}"`);

    // Use function calling for structured output
    const response = await client.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      tools: [
        {
          type: "function",
          function: {
            name: "process_response",
            description: "Process the AI response with intent and entity extraction",
            parameters: {
              type: "object",
              properties: {
                response: {
                  type: "string",
                  description: "The natural language response to the user",
                },
                intent: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: `The detected intent. Must be one of: ${intents.map((i) => i.name).join(", ") || "unknown"}`,
                    },
                    confidence: {
                      type: "number",
                      description: "Confidence score between 0 and 1",
                    },
                  },
                  required: ["name", "confidence"],
                },
                extractedEntities: {
                  type: "object",
                  description: "Extracted entities from the conversation",
                  additionalProperties: true,
                },
                nextAction: {
                  type: "string",
                  enum: ["continue", "transfer", "end_call", "escalate"],
                  description: "What should happen next in the conversation",
                },
                shouldWaitForInput: {
                  type: "boolean",
                  description: "Whether we need to wait for user input",
                },
              },
              required: ["response", "intent", "extractedEntities", "nextAction", "shouldWaitForInput"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "process_response" } },
    });

    // Extract the structured response
    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    let structuredResponse: StructuredResponse;

    if (toolCall && toolCall.type === "function" && toolCall.function?.arguments) {
      try {
        structuredResponse = JSON.parse(toolCall.function.arguments);
      } catch {
        // Fallback if parsing fails
        structuredResponse = {
          response: response.choices[0]?.message?.content || "I'm sorry, I didn't understand that.",
          intent: { name: "unknown", confidence: 0.5 },
          extractedEntities: {},
          nextAction: "continue",
          shouldWaitForInput: true,
        };
      }
    } else {
      // Fallback to content if no tool call
      structuredResponse = {
        response: response.choices[0]?.message?.content || "I'm sorry, I didn't understand that.",
        intent: { name: "unknown", confidence: 0.5 },
        extractedEntities: {},
        nextAction: "continue",
        shouldWaitForInput: true,
      };
    }

    console.log(`🤖 [Canvas/Chat] Response: "${structuredResponse.response}"`);
    console.log(`🎯 [Canvas/Chat] Intent: ${structuredResponse.intent.name} (${structuredResponse.intent.confidence})`);
    console.log(`📦 [Canvas/Chat] Entities:`, structuredResponse.extractedEntities);

    return NextResponse.json({
      ...structuredResponse,
      success: true,
    });
  } catch (error) {
    console.error("Canvas chat error:", error);

    if (error instanceof Error && error.message.includes("OPENAI_API_KEY")) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
