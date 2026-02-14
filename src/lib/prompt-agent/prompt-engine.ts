import OpenAI from "openai";
import { mergeSinglePromptConfig } from "./defaults";
import {
  buildEnhancedSystemPrompt,
  normalizeForSpeech,
  splitIntoSentences,
} from "./system-prompts";
import type {
  PromptAgentTool,
  PromptTurnResult,
  SinglePromptConfig,
} from "./types";
import { substituteVariables } from "@/lib/canvas/server-execution-engine";
import { getProvider, isValidProvider } from "@/lib/integrations";
import {
  getDecryptedCredentials,
  getIntegration,
} from "@/services/integration.service";
import type { IntegrationRow, ProviderCredentials } from "@/lib/integrations/types";

type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Callback for streaming sentences as they're generated
 */
export type SentenceCallback = (sentence: string, isLast: boolean) => Promise<void>;

interface TurnLatencyMetrics {
  totalMs: number;
  llmMs: number;
  toolsMs: number;
  ttsMs?: number;
  toolCalls: number;
  retries: number;
  firstTokenMs?: number;    // Time to first LLM token
  firstSentenceMs?: number; // Time to first complete sentence
  sentenceCount?: number;   // Number of sentences in response
}

/**
 * Result of streaming turn processing
 */
export interface StreamingTurnResult extends PromptTurnResult {
  sentences: string[];
}

export class PromptAgentEngine {
  private config: SinglePromptConfig;
  private variables: Record<string, unknown>;
  private history: ChatMessage[];
  private openai: OpenAI;
  private organizationId?: string;
  private currentTurnRetries = 0;
  private lastTurnMetrics: TurnLatencyMetrics = {
    totalMs: 0,
    llmMs: 0,
    toolsMs: 0,
    toolCalls: 0,
    retries: 0,
  };
  private bookingResultCache = new Map<string, Record<string, unknown>>();
  private integrationCache = new Map<
    string,
    {
      row: IntegrationRow;
      credentials: ProviderCredentials;
      providerInstance: ReturnType<typeof getProvider>;
    }
  >();

  constructor(params: {
    config: Partial<SinglePromptConfig> | undefined;
    variables?: Record<string, unknown>;
    history?: ChatMessage[];
    organizationId?: string;
  }) {
    this.config = mergeSinglePromptConfig(params.config);
    this.variables = { ...(params.variables || {}) };
    this.history = [...(params.history || [])];
    this.organizationId = params.organizationId;
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  getConfig(): SinglePromptConfig {
    return this.config;
  }

  getVariables(): Record<string, unknown> {
    return this.variables;
  }

  getHistory(): ChatMessage[] {
    return this.history;
  }

  getLastTurnMetrics(): TurnLatencyMetrics {
    return this.lastTurnMetrics;
  }

  async warmup(): Promise<void> {
    const providers = new Set<string>();
    for (const tool of this.config.tools) {
      if (tool.type === "integration") {
        providers.add(tool.provider);
      }
      if (tool.type === "check_availability" || tool.type === "book_slot") {
        providers.add("google_calendar");
      }
    }
    await Promise.all(
      Array.from(providers).map(async (provider) => {
        try {
          await this.getCachedIntegration(provider);
        } catch (error) {
          console.warn("[PromptAgentEngine] Warmup skipped for provider", {
            provider,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })
    );
  }

  async getBeginMessage(): Promise<string> {
    if (this.config.beginMessageMode === "static") {
      return this.config.beginMessage || "";
    }

    const completion = await this.openai.chat.completions.create({
      model: this.config.model,
      temperature: this.config.temperature,
      max_tokens: 120,
      messages: [
        { role: "system", content: this.buildSystemPrompt() },
        {
          role: "user",
          content:
            "Generate only the opening line the agent should say to start the call.",
        },
      ],
    });

    return completion.choices[0]?.message?.content?.trim() || "";
  }

  async processUserInput(userText: string): Promise<PromptTurnResult> {
    const turnStartedAt = Date.now();
    let llmMs = 0;
    let toolsMs = 0;
    let toolCalls = 0;
    this.currentTurnRetries = 0;

    this.history.push({ role: "user", content: userText });
    this.variables.user_input = userText;

    const tools = this.buildToolDefinitions();
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: this.buildSystemPrompt() },
      ...this.history.map((h) => ({ role: h.role, content: h.content })),
    ];

    let action: PromptTurnResult["action"] = "gather";
    let transferTo: string | undefined;
    let transferType: "cold" | "warm" | undefined;
    let finalResponse = "";

    for (let i = 0; i < 3; i++) {
      const llmStartedAt = Date.now();
      const completion = await this.openai.chat.completions.create({
        model: this.config.model,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens || 300,
        messages,
        tools,
        tool_choice: tools.length ? "auto" : undefined,
      });
      llmMs += Date.now() - llmStartedAt;

      const message = completion.choices[0]?.message;
      if (!message) break;

      if (!message.tool_calls || message.tool_calls.length === 0) {
        finalResponse = message.content?.trim() || "";
        if (finalResponse) {
          this.history.push({ role: "assistant", content: finalResponse });
        }
        break;
      }

      // Preserve the assistant tool_call message so subsequent tool messages
      // are valid for the OpenAI API conversation format.
      const assistantToolCalls = message.tool_calls
        .filter(
          (toolCall): toolCall is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall =>
            "function" in toolCall
        )
        .map((toolCall) => ({
          id: toolCall.id,
          type: "function" as const,
          function: {
            name: toolCall.function.name,
            arguments: toolCall.function.arguments || "{}",
          },
        }));

      messages.push({
        role: "assistant",
        content: message.content || "",
        tool_calls: assistantToolCalls,
      } as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam);

      for (const toolCall of message.tool_calls) {
        if (!("function" in toolCall)) continue;
        const parsed = toolCall.function.arguments
          ? (JSON.parse(toolCall.function.arguments) as Record<string, unknown>)
          : {};

        const startedAt = Date.now();
        const toolResult = await this.handleToolCall(toolCall.function.name, parsed);
        const durationMs = Date.now() - startedAt;
        toolsMs += durationMs;
        toolCalls++;
        console.log("[PromptAgentEngine] Tool call", {
          tool: toolCall.function.name,
          durationMs,
          ok: Boolean(toolResult.payload?.ok),
          error:
            typeof toolResult.payload?.error === "string"
              ? toolResult.payload.error
              : undefined,
        });
        if (toolResult.action === "end") action = "end";
        if (toolResult.action === "transfer") {
          action = "transfer";
          transferTo = toolResult.transferTo;
          transferType = toolResult.transferType;
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult.payload),
        } as OpenAI.Chat.Completions.ChatCompletionToolMessageParam);
      }
    }

    // Normalize response for speech if enabled
    if (this.config.normalizeForSpeech && finalResponse) {
      finalResponse = normalizeForSpeech(finalResponse);
    }

    this.lastTurnMetrics = {
      totalMs: Date.now() - turnStartedAt,
      llmMs,
      toolsMs,
      toolCalls,
      retries: this.currentTurnRetries,
      sentenceCount: splitIntoSentences(finalResponse).length,
    };
    console.log("[PromptAgentEngine] Turn latency", this.lastTurnMetrics);

    return {
      response: finalResponse,
      action,
      variables: this.variables,
      transferTo,
      transferType,
    };
  }

  /**
   * Process user input with streaming sentence callback
   * Calls onSentence for each sentence as it's generated,
   * allowing TTS to start while LLM is still generating
   */
  async processUserInputStreaming(
    userText: string,
    onSentence: SentenceCallback
  ): Promise<StreamingTurnResult> {
    const turnStartedAt = Date.now();
    let llmMs = 0;
    let toolsMs = 0;
    let toolCalls = 0;
    let firstTokenMs: number | undefined;
    let firstSentenceMs: number | undefined;
    this.currentTurnRetries = 0;

    this.history.push({ role: "user", content: userText });
    this.variables.user_input = userText;

    const tools = this.buildToolDefinitions();
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: this.buildSystemPrompt() },
      ...this.history.map((h) => ({ role: h.role, content: h.content })),
    ];

    let action: PromptTurnResult["action"] = "gather";
    let transferTo: string | undefined;
    let transferType: "cold" | "warm" | undefined;
    const sentences: string[] = [];
    let fullResponse = "";

    for (let i = 0; i < 3; i++) {
      const llmStartedAt = Date.now();

      // Use streaming for the final response generation
      if (tools.length === 0 || i > 0) {
        // Stream the response
        const stream = await this.openai.chat.completions.create({
          model: this.config.model,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens || 300,
          messages,
          tools: tools.length ? tools : undefined,
          tool_choice: tools.length ? "auto" : undefined,
          stream: true,
        });

        let buffer = "";
        const sentenceEnders = /([.!?])\s*/;

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          const toolCallsDelta = chunk.choices[0]?.delta?.tool_calls;

          // Track first token
          if (content && !firstTokenMs) {
            firstTokenMs = Date.now() - turnStartedAt;
          }

          // If tool calls detected, fall back to non-streaming
          if (toolCallsDelta && toolCallsDelta.length > 0) {
            // Re-process without streaming for tool handling
            break;
          }

          if (content) {
            buffer += content;
            fullResponse += content;

            // Extract complete sentences
            const parts = buffer.split(sentenceEnders);
            while (parts.length > 2) {
              const sentence = (parts.shift()! + parts.shift()!).trim();
              if (sentence) {
                // Track first sentence time
                if (!firstSentenceMs) {
                  firstSentenceMs = Date.now() - turnStartedAt;
                }

                // Normalize for speech
                const normalized = this.config.normalizeForSpeech
                  ? normalizeForSpeech(sentence)
                  : sentence;

                sentences.push(normalized);
                await onSentence(normalized, false);
              }
            }
            buffer = parts.join("");
          }

          // Check for completion
          if (chunk.choices[0]?.finish_reason) {
            // Flush remaining buffer
            if (buffer.trim()) {
              const normalized = this.config.normalizeForSpeech
                ? normalizeForSpeech(buffer.trim())
                : buffer.trim();
              sentences.push(normalized);
              await onSentence(normalized, true);
            } else if (sentences.length > 0) {
              // Notify last sentence was actually last
              // (callback already called, this is just for cleanup)
            }
            break;
          }
        }

        llmMs += Date.now() - llmStartedAt;

        if (fullResponse) {
          this.history.push({ role: "assistant", content: fullResponse });
        }
        break;
      }

      // Non-streaming path for tool handling
      const completion = await this.openai.chat.completions.create({
        model: this.config.model,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens || 300,
        messages,
        tools,
        tool_choice: "auto",
      });
      llmMs += Date.now() - llmStartedAt;

      const message = completion.choices[0]?.message;
      if (!message) break;

      if (!message.tool_calls || message.tool_calls.length === 0) {
        fullResponse = message.content?.trim() || "";
        if (fullResponse) {
          // Process sentences for the non-streamed response
          const responseSentences = splitIntoSentences(fullResponse);
          for (let j = 0; j < responseSentences.length; j++) {
            const normalized = this.config.normalizeForSpeech
              ? normalizeForSpeech(responseSentences[j])
              : responseSentences[j];
            sentences.push(normalized);
            await onSentence(normalized, j === responseSentences.length - 1);
          }
          this.history.push({ role: "assistant", content: fullResponse });
        }
        break;
      }

      // Handle tool calls (same as non-streaming)
      const assistantToolCalls = message.tool_calls
        .filter(
          (toolCall): toolCall is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall =>
            "function" in toolCall
        )
        .map((toolCall) => ({
          id: toolCall.id,
          type: "function" as const,
          function: {
            name: toolCall.function.name,
            arguments: toolCall.function.arguments || "{}",
          },
        }));

      messages.push({
        role: "assistant",
        content: message.content || "",
        tool_calls: assistantToolCalls,
      } as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam);

      for (const toolCall of message.tool_calls) {
        if (!("function" in toolCall)) continue;
        const parsed = toolCall.function.arguments
          ? (JSON.parse(toolCall.function.arguments) as Record<string, unknown>)
          : {};

        const startedAt = Date.now();
        const toolResult = await this.handleToolCall(toolCall.function.name, parsed);
        const durationMs = Date.now() - startedAt;
        toolsMs += durationMs;
        toolCalls++;

        if (toolResult.action === "end") action = "end";
        if (toolResult.action === "transfer") {
          action = "transfer";
          transferTo = toolResult.transferTo;
          transferType = toolResult.transferType;
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult.payload),
        } as OpenAI.Chat.Completions.ChatCompletionToolMessageParam);
      }
    }

    this.lastTurnMetrics = {
      totalMs: Date.now() - turnStartedAt,
      llmMs,
      toolsMs,
      toolCalls,
      retries: this.currentTurnRetries,
      firstTokenMs,
      firstSentenceMs,
      sentenceCount: sentences.length,
    };
    console.log("[PromptAgentEngine] Streaming turn latency", this.lastTurnMetrics);

    return {
      response: fullResponse,
      action,
      variables: this.variables,
      transferTo,
      transferType,
      sentences,
    };
  }

  private buildSystemPrompt(): string {
    // Use the enhanced system prompt builder with all voice-specific instructions
    return buildEnhancedSystemPrompt(this.config);
  }

  private buildToolDefinitions(): Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    return this.config.tools.map((tool) => {
      if (tool.type === "end_call") {
        return {
          type: "function" as const,
          function: {
            name: "end_call",
            description: tool.description || "End the phone call",
            parameters: { type: "object", properties: {}, additionalProperties: false },
          },
        };
      }

      if (tool.type === "transfer_call") {
        return {
          type: "function" as const,
          function: {
            name: "transfer_call",
            description:
              tool.description ||
              `Transfer the call to ${tool.destination}`,
            parameters: {
              type: "object",
              properties: {
                destination: { type: "string" },
                transferType: { type: "string", enum: ["cold", "warm"] },
              },
              required: ["destination", "transferType"],
              additionalProperties: false,
            },
          },
        };
      }

      if (tool.type === "http") {
        return {
          type: "function" as const,
          function: {
            name: `http__${sanitizeName(tool.name)}`,
            description: tool.description,
            parameters: {
              type: "object",
              properties: {
                body: { type: "object" },
              },
              additionalProperties: true,
            },
          },
        };
      }

      if (tool.type === "check_availability") {
        return {
          type: "function" as const,
          function: {
            name: "check_availability",
            description:
              tool.description ||
              "Check calendar availability for a date and return available slots",
            parameters: {
              type: "object",
              properties: {
                date: { type: "string", description: "Date in YYYY-MM-DD format" },
                duration_minutes: { type: "number" },
                calendar_id: { type: "string" },
              },
              required: ["date"],
              additionalProperties: false,
            },
          },
        };
      }

      if (tool.type === "book_slot") {
        return {
          type: "function" as const,
          function: {
            name: "book_slot",
            description:
              tool.description ||
              "Book a calendar appointment for a confirmed time slot",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                start_time: {
                  type: "string",
                  description: "ISO datetime or YYYY-MM-DD HH:MM",
                },
                duration_minutes: { type: "number" },
                attendee_email: { type: "string" },
                description: { type: "string" },
                calendar_id: { type: "string" },
              },
              required: ["title", "start_time"],
              additionalProperties: false,
            },
          },
        };
      }

      return {
        type: "function" as const,
        function: {
          name: `integration__${tool.provider}__${sanitizeName(tool.actionId)}`,
          description:
            tool.description ||
            `Run integration action ${tool.actionId} on ${tool.provider}`,
          parameters: {
            type: "object",
            properties: {},
            additionalProperties: true,
          },
        },
      };
    });
  }

  private async handleToolCall(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{
    action?: "end" | "transfer";
    transferTo?: string;
    transferType?: "cold" | "warm";
    payload: Record<string, unknown>;
  }> {
    if (toolName === "end_call") {
      return { action: "end", payload: { ok: true } };
    }

    if (toolName === "transfer_call") {
      const destination = String(args.destination || "");
      const transferType = (String(args.transferType || "cold") === "warm"
        ? "warm"
        : "cold") as "cold" | "warm";
      return {
        action: "transfer",
        transferTo: destination,
        transferType,
        payload: { ok: true, destination, transferType },
      };
    }

    if (toolName.startsWith("http__")) {
      const httpTool = this.config.tools.find(
        (t): t is Extract<PromptAgentTool, { type: "http" }> =>
          t.type === "http" && `http__${sanitizeName(t.name)}` === toolName
      );
      if (!httpTool) return { payload: { ok: false, error: "Tool not found" } };

      try {
        const body = httpTool.bodyTemplate
          ? substituteVariables(httpTool.bodyTemplate, this.variables)
          : args.body
            ? JSON.stringify(args.body)
            : undefined;

        const response = await this.fetchWithRetry(httpTool.url, {
          method: httpTool.method,
          headers: {
            "Content-Type": "application/json",
            ...(httpTool.headers || {}),
          },
          body: httpTool.method === "GET" ? undefined : body,
        });
        let data: unknown = null;
        try {
          data = await response.json();
        } catch {
          data = await response.text();
        }
        this.variables._last_http_result = data;
        return {
          payload: {
            ok: response.ok,
            status: response.status,
            data,
          },
        };
      } catch (error) {
        return {
          payload: {
            ok: false,
            error: error instanceof Error ? error.message : "HTTP tool failed",
          },
        };
      }
    }

    if (toolName === "check_availability") {
      const calendarTool = this.config.tools.find(
        (t): t is Extract<PromptAgentTool, { type: "check_availability" }> =>
          t.type === "check_availability"
      );
      if (!calendarTool) {
        return { payload: { ok: false, error: "Tool not configured" } };
      }

      try {
        const result = await this.executeIntegrationAction(
          calendarTool.provider,
          "google_calendar.check_availability",
          {
            date: args.date,
            duration_minutes:
              Number(args.duration_minutes) ||
              calendarTool.defaultDurationMinutes ||
              30,
            calendar_id:
              (args.calendar_id as string) || calendarTool.calendarId || "primary",
          },
          calendarTool.timezone
        );
        this.variables._last_availability_result = result.data;
        return { payload: { ok: result.success, data: result.data, error: result.error } };
      } catch (error) {
        return {
          payload: {
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Availability check failed",
          },
        };
      }
    }

    if (toolName === "book_slot") {
      const calendarTool = this.config.tools.find(
        (t): t is Extract<PromptAgentTool, { type: "book_slot" }> =>
          t.type === "book_slot"
      );
      if (!calendarTool) {
        return { payload: { ok: false, error: "Tool not configured" } };
      }

      try {
        const bookingKey = this.getBookingKey(args, calendarTool.calendarId);
        const existing = this.bookingResultCache.get(bookingKey);
        if (existing) {
          return { payload: { ok: true, data: existing, deduplicated: true } };
        }

        const result = await this.executeIntegrationAction(
          calendarTool.provider,
          "google_calendar.book_appointment",
          {
            title: args.title,
            start_time: args.start_time,
            duration_minutes:
              Number(args.duration_minutes) ||
              calendarTool.defaultDurationMinutes ||
              30,
            attendee_email: args.attendee_email,
            description: args.description,
            calendar_id:
              (args.calendar_id as string) || calendarTool.calendarId || "primary",
          },
          calendarTool.timezone
        );
        if (result.success) {
          this.bookingResultCache.set(bookingKey, result.data);
        }
        this.variables._last_booking_result = result.data;
        return { payload: { ok: result.success, data: result.data, error: result.error } };
      } catch (error) {
        return {
          payload: {
            ok: false,
            error:
              error instanceof Error ? error.message : "Booking appointment failed",
          },
        };
      }
    }

    if (toolName.startsWith("integration__")) {
      const parts = toolName.split("__");
      const provider = parts[1];
      const actionIdSlug = parts.slice(2).join("__");

      const integrationTool = this.config.tools.find(
        (t): t is Extract<PromptAgentTool, { type: "integration" }> =>
          t.type === "integration" &&
          t.provider === provider &&
          sanitizeName(t.actionId) === actionIdSlug
      );

      if (!integrationTool || !this.organizationId) {
        return { payload: { ok: false, error: "Integration tool unavailable" } };
      }

      try {
        if (!isValidProvider(integrationTool.provider)) {
          return { payload: { ok: false, error: "Invalid integration provider" } };
        }

        const cached = await this.getCachedIntegration(integrationTool.provider);
        if (!cached) {
          return { payload: { ok: false, error: "Integration not connected" } };
        }

        const mappedInputs: Record<string, unknown> = { ...args };
        if (integrationTool.inputMappings) {
          Object.entries(integrationTool.inputMappings).forEach(([k, template]) => {
            mappedInputs[k] = substituteVariables(template, this.variables);
          });
        }

        const result = await cached.providerInstance.executeAction(
          integrationTool.actionId,
          mappedInputs,
          cached.credentials,
          cached.row.settings || {}
        );
        this.variables._last_integration_result = result.data;
        return { payload: { ok: result.success, data: result.data, error: result.error } };
      } catch (error) {
        return {
          payload: {
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Integration execution failed",
          },
        };
      }
    }

    return { payload: { ok: false, error: "Unknown tool" } };
  }

  private async executeIntegrationAction(
    provider: string,
    actionId: string,
    inputs: Record<string, unknown>,
    timezone?: string
  ) {
    if (!isValidProvider(provider)) {
      throw new Error(`Invalid provider: ${provider}`);
    }

    const cached = await this.getCachedIntegration(provider);
    if (!cached) {
      throw new Error("Integration not connected");
    }

    let lastError: string | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await cached.providerInstance.executeAction(
        actionId,
        inputs,
        cached.credentials,
        {
          ...(cached.row.settings || {}),
          ...(timezone ? { timezone } : {}),
        }
      );

      if (result.success || !this.shouldRetryProviderResult(result.error)) {
        return result;
      }

      lastError = result.error || "Transient integration error";
      this.currentTurnRetries += 1;
      await this.sleep(100 + Math.floor(Math.random() * 120));
    }

    throw new Error(lastError || "Integration execution failed");
  }

  private async getCachedIntegration(
    provider: string
  ): Promise<
    | {
        row: IntegrationRow;
        credentials: ProviderCredentials;
        providerInstance: ReturnType<typeof getProvider>;
      }
    | null
  > {
    if (!this.organizationId || !isValidProvider(provider)) {
      return null;
    }

    const existing = this.integrationCache.get(provider);
    if (existing) {
      return existing;
    }

    const row = await getIntegration(this.organizationId, provider);
    if (!row || !row.credentials) {
      return null;
    }

    const credentials = await getDecryptedCredentials(row);
    const cached = {
      row,
      credentials,
      providerInstance: getProvider(provider),
    };
    this.integrationCache.set(provider, cached);
    return cached;
  }

  private getBookingKey(
    args: Record<string, unknown>,
    fallbackCalendarId?: string
  ): string {
    const normalized = {
      title: String(args.title || "").trim().toLowerCase(),
      startTime: String(args.start_time || "").trim().toLowerCase(),
      attendeeEmail: String(args.attendee_email || "").trim().toLowerCase(),
      calendarId: String(args.calendar_id || fallbackCalendarId || "primary")
        .trim()
        .toLowerCase(),
      duration: Number(args.duration_minutes || 30),
    };
    return JSON.stringify(normalized);
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(url, init);
        if (!this.shouldRetryHttpStatus(response.status) || attempt === 1) {
          return response;
        }
        this.currentTurnRetries += 1;
      } catch (error) {
        if (attempt === 1 || !this.isTransientError(error)) {
          throw error;
        }
        this.currentTurnRetries += 1;
        lastError =
          error instanceof Error ? error : new Error("Transient HTTP tool failure");
      }
      await this.sleep(100 + Math.floor(Math.random() * 120));
    }
    throw lastError || new Error("HTTP tool failed after retry");
  }

  private shouldRetryProviderResult(error?: string): boolean {
    if (!error) return false;
    const message = error.toLowerCase();
    return (
      message.includes("429") ||
      message.includes("timeout") ||
      message.includes("temporar") ||
      message.includes("rate limit") ||
      message.includes("503") ||
      message.includes("502") ||
      message.includes("500")
    );
  }

  private shouldRetryHttpStatus(status: number): boolean {
    return status === 429 || status >= 500;
  }

  private isTransientError(error: unknown): boolean {
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("temporar") ||
      message.includes("network")
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

function sanitizeName(input: string): string {
  return input.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
}
