/**
 * Twilio Media Stream Handler
 *
 * Handles bidirectional audio streaming between Twilio and our voice pipeline.
 * Replaces the <Say>/<Gather> approach with real-time streaming:
 *
 *   Caller audio → Twilio WebSocket → Deepgram STT (streaming)
 *   ElevenLabs TTS (streaming) → Twilio WebSocket → Caller hears
 *
 * Audio format: μ-law 8kHz mono (Twilio's native format)
 * Deepgram accepts mulaw natively. ElevenLabs can output ulaw_8000.
 *
 * @module lib/voice/twilio-media-stream
 */

import type WebSocket from "ws";
import { createTranscriptionStream } from "./deepgram";
import { synthesizeSpeechMulaw } from "./elevenlabs";
import { getFlowByWebhookId, getPublishedFlowVersion } from "@/services/flow.service";
import { query } from "@/lib/db";
import {
  executeNode,
  findStartNode,
  findNextNode,
  initializeVariables,
  type FlowNodeData,
  type FlowEdgeData,
} from "@/lib/canvas/server-execution-engine";

// ============================================
// Types
// ============================================

export interface MediaStreamConfig {
  callId: string;
  webhookId: string;
  callerNumber?: string;
  calleeNumber?: string;
}

// Twilio WebSocket message types
interface TwilioConnectedEvent {
  event: "connected";
  protocol: string;
  version: string;
}

interface TwilioStartEvent {
  event: "start";
  sequenceNumber: string;
  start: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
    customParameters: Record<string, string>;
  };
}

interface TwilioMediaEvent {
  event: "media";
  sequenceNumber: string;
  media: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string; // base64-encoded audio
  };
}

interface TwilioStopEvent {
  event: "stop";
  sequenceNumber: string;
  stop: {
    accountSid: string;
    callSid: string;
  };
}

interface TwilioMarkEvent {
  event: "mark";
  sequenceNumber: string;
  mark: {
    name: string;
  };
}

type TwilioEvent = TwilioConnectedEvent | TwilioStartEvent | TwilioMediaEvent | TwilioStopEvent | TwilioMarkEvent;

// ============================================
// Constants
// ============================================

const MULAW_SAMPLE_RATE = 8000;
const SILENCE_THRESHOLD_MS = 1000; // 1 second silence before processing

// ============================================
// TwilioMediaStreamHandler
// ============================================

export class TwilioMediaStreamHandler {
  private ws: WebSocket;
  private config: MediaStreamConfig;
  private streamSid: string | null = null;
  private callSid: string | null = null;

  // STT
  private sttConnection: Awaited<ReturnType<typeof createTranscriptionStream>> | null = null;
  private pendingUserText = "";
  private silenceTimeout: NodeJS.Timeout | null = null;
  private isProcessing = false;

  // TTS playback state
  private isSpeaking = false;
  private markCounter = 0;

  // Flow state
  private flowNodes: FlowNodeData[] = [];
  private flowEdges: FlowEdgeData[] = [];
  private currentNodeId = "";
  private variables: Record<string, unknown> = {};
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private turnCount = 0;

  constructor(ws: WebSocket, config: MediaStreamConfig) {
    console.log(`[TwilioMedia] Handler created for call: ${config.callId}`);
    this.ws = ws;
    this.config = config;
    this.setupWebSocket();
  }

  // ============================================
  // WebSocket Event Handling
  // ============================================

  private setupWebSocket(): void {
    console.log(`[TwilioMedia] Setting up WebSocket listeners...`);

    this.ws.on("message", (data: Buffer | string) => {
      try {
        const message: TwilioEvent = JSON.parse(data.toString());
        if (message.event !== "media") {
          console.log(`[TwilioMedia] Received event: ${message.event}`);
        }
        this.handleMessage(message);
      } catch (error) {
        console.error("[TwilioMedia] Failed to parse Twilio message:", error);
      }
    });

    this.ws.on("close", () => {
      console.log(`Media stream closed for call: ${this.config.callId}`);
      this.cleanup();
    });

    this.ws.on("error", (error) => {
      console.error("Media stream WebSocket error:", error);
      this.cleanup();
    });
  }

  private async handleMessage(message: TwilioEvent): Promise<void> {
    switch (message.event) {
      case "connected":
        console.log("[TwilioMedia] Twilio WebSocket connected");
        break;

      case "start":
        this.streamSid = message.start.streamSid;
        this.callSid = message.start.callSid;
        console.log(`[TwilioMedia] Stream started: streamSid=${this.streamSid}, callSid=${this.callSid}`);

        // Get custom parameters passed via <Parameter> elements in TwiML
        const customParams = message.start.customParameters || {};
        console.log(`[TwilioMedia] Custom parameters:`, customParams);

        // Update config with params from Twilio
        if (customParams.callId) this.config.callId = customParams.callId;
        if (customParams.webhookId) this.config.webhookId = customParams.webhookId;
        if (customParams.callerNumber) this.config.callerNumber = customParams.callerNumber;
        if (customParams.calleeNumber) this.config.calleeNumber = customParams.calleeNumber;

        console.log(`[TwilioMedia] Config updated: callId=${this.config.callId}, webhookId=${this.config.webhookId}`);

        // Initialize everything
        console.log(`[TwilioMedia] Starting initialization...`);
        await this.initialize();
        console.log(`[TwilioMedia] Initialization complete`);
        break;

      case "media":
        this.handleAudio(message.media.payload);
        break;

      case "mark":
        this.handleMark(message.mark.name);
        break;

      case "stop":
        console.log("Twilio media stream stopped");
        await this.endCall();
        break;
    }
  }

  // ============================================
  // Initialization
  // ============================================

  private async initialize(): Promise<void> {
    console.log(`[TwilioMedia] Initializing for webhookId: ${this.config.webhookId}`);
    try {
      // Load flow data
      console.log(`[TwilioMedia] Loading flow data...`);
      await this.loadFlowData();

      // Start Deepgram STT stream (mulaw encoding, 8kHz)
      this.sttConnection = await createTranscriptionStream(
        (result) => this.handleTranscript(result),
        (error) => console.error("STT error:", error),
        {
          encoding: "mulaw",
          sampleRate: MULAW_SAMPLE_RATE,
        }
      );

      console.log("Deepgram STT connected (mulaw 8kHz)");

      // Execute start node and speak greeting
      await this.executeStartNode();
    } catch (error) {
      console.error("Failed to initialize media stream:", error);
      this.sendAudioMessage("I'm sorry, there was an error starting the conversation.");
    }
  }

  private async loadFlowData(): Promise<void> {
    console.log(`[TwilioMedia] Looking up flow for webhookId: ${this.config.webhookId}`);
    const flow = await getFlowByWebhookId(this.config.webhookId);
    if (!flow) {
      throw new Error(`Flow not found for webhook: ${this.config.webhookId}`);
    }
    console.log(`[TwilioMedia] Found flow: ${flow.id} (${flow.name})`);

    const publishedVersion = await getPublishedFlowVersion(flow.id);
    console.log(`[TwilioMedia] Published version: ${publishedVersion ? `v${publishedVersion.versionNumber}` : 'using draft'}`);
    const flowData = publishedVersion?.flowData || flow.flowData;

    this.flowNodes = (flowData.nodes || []) as FlowNodeData[];
    this.flowEdges = (flowData.edges || []) as FlowEdgeData[];
    this.variables = initializeVariables(flowData.variables || []);
    this.currentNodeId = findStartNode(this.flowNodes);

    console.log(`Flow loaded: ${this.flowNodes.length} nodes`);
  }

  private async executeStartNode(): Promise<void> {
    console.log(`[TwilioMedia] Executing start node...`);
    console.log(`[TwilioMedia] Flow has ${this.flowNodes.length} nodes`);

    const startNode = this.flowNodes.find((n) => n.type === "start");
    if (!startNode) {
      console.log(`[TwilioMedia] No start node found!`);
      console.log(`[TwilioMedia] Available node types: ${this.flowNodes.map(n => n.type).join(', ')}`);
      return;
    }

    console.log(`[TwilioMedia] Start node found: ${startNode.id}`);
    const config = (startNode.data as { config?: Record<string, unknown> })?.config || {};
    console.log(`[TwilioMedia] Start node config:`, JSON.stringify(config));
    const greeting = (config.greeting as string) || "Hello! How can I help you today?";

    console.log(`[TwilioMedia] Speaking greeting: "${greeting}"`);
    // Speak greeting with ElevenLabs
    await this.speak(greeting);
    this.conversationHistory.push({ role: "assistant", content: greeting });
    console.log(`[TwilioMedia] Greeting spoken successfully`);

    // Move to next node
    const nextNodeId = findNextNode(this.flowEdges, startNode.id, "default");
    console.log(`[TwilioMedia] Next node after start: ${nextNodeId || 'none'}`);

    if (nextNodeId) {
      this.currentNodeId = nextNodeId;
      const nextNode = this.flowNodes.find(n => n.id === nextNodeId);
      console.log(`[TwilioMedia] Moving to node: ${nextNode?.type || 'unknown'}`);
    }
  }

  // ============================================
  // Audio Input: Twilio → Deepgram STT
  // ============================================

  private handleAudio(base64Payload: string): void {
    if (!this.sttConnection?.isOpen()) return;

    // Decode base64 μ-law audio and send directly to Deepgram
    // Deepgram accepts mulaw encoding natively - no conversion needed
    const audioBuffer = Buffer.from(base64Payload, "base64");
    this.sttConnection.send(audioBuffer);
  }

  private handleTranscript(result: { text: string; isFinal: boolean }): void {
    if (!result.text.trim()) return;

    if (result.isFinal) {
      // If user speaks while agent is talking, interrupt (barge-in)
      if (this.isSpeaking) {
        this.interruptPlayback();
      }

      this.pendingUserText += " " + result.text;
      this.pendingUserText = this.pendingUserText.trim();

      // Reset silence timer
      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
      }

      // Wait for pause before processing
      this.silenceTimeout = setTimeout(() => {
        if (this.pendingUserText && !this.isProcessing) {
          const text = this.pendingUserText;
          this.pendingUserText = "";
          this.processUserInput(text);
        }
      }, SILENCE_THRESHOLD_MS);
    }
  }

  // ============================================
  // Flow Processing
  // ============================================

  private async processUserInput(userText: string): Promise<void> {
    if (this.isProcessing) return;

    try {
      this.isProcessing = true;
      this.turnCount++;

      console.log(`[Turn ${this.turnCount}] User: "${userText}"`);
      this.conversationHistory.push({ role: "user", content: userText });
      this.variables["user_input"] = userText;

      // Execute current node using shared engine
      const result = await executeNode(
        this.flowNodes,
        this.flowEdges,
        this.currentNodeId,
        userText,
        this.variables,
        this.conversationHistory
      );

      // Apply variable updates
      this.variables = result.variables;

      // Speak the response
      if (result.response) {
        console.log(`[Turn ${this.turnCount}] Agent: "${result.response}"`);
        await this.speak(result.response);
        this.conversationHistory.push({ role: "assistant", content: result.response });
      }

      // Log call event
      await this.logEvent("conversation_turn", {
        nodeId: this.currentNodeId,
        userInput: userText,
        agentResponse: result.response,
        action: result.action,
      });

      // Handle action
      switch (result.action) {
        case "end":
          await this.endCall();
          return;
        case "transfer":
          console.log(`Transferring to: ${result.transferTo}`);
          await this.endCall();
          return;
        case "gather":
          if (result.nextNodeId) {
            this.currentNodeId = result.nextNodeId;
          }
          break;
      }
    } catch (error) {
      console.error("Error processing user input:", error);
      await this.speak("I'm sorry, I encountered an error. Could you repeat that?");
    } finally {
      this.isProcessing = false;
    }
  }

  // ============================================
  // Audio Output: ElevenLabs TTS → Twilio
  // ============================================

  /**
   * Speak text using ElevenLabs and stream audio back to Twilio.
   * Uses ulaw_8000 format - Twilio's native encoding.
   */
  private async speak(text: string): Promise<void> {
    console.log(`[TwilioMedia] speak() called with: "${text.substring(0, 50)}..."`);
    if (!this.streamSid) {
      console.log(`[TwilioMedia] No streamSid yet, cannot speak`);
      return;
    }

    try {
      this.isSpeaking = true;

      // Synthesize with ElevenLabs in μ-law 8kHz format (Twilio native)
      console.log(`[TwilioMedia] Calling ElevenLabs TTS...`);
      const audioBuffer = await synthesizeSpeechMulaw(text);
      console.log(`[TwilioMedia] Got audio buffer: ${audioBuffer.length} bytes`);

      // Send audio in chunks to Twilio
      // Twilio expects ~20ms chunks of base64-encoded audio
      const chunkSize = 160; // 160 bytes = 20ms of 8kHz mulaw audio
      let offset = 0;
      let chunkCount = 0;

      while (offset < audioBuffer.length) {
        if (this.ws.readyState !== 1) {
          console.log(`[TwilioMedia] WebSocket closed during audio send`);
          break;
        }

        const end = Math.min(offset + chunkSize, audioBuffer.length);
        const chunk = audioBuffer.slice(offset, end);

        const message = JSON.stringify({
          event: "media",
          streamSid: this.streamSid,
          media: {
            payload: chunk.toString("base64"),
          },
        });

        this.ws.send(message);
        offset = end;
        chunkCount++;
      }

      console.log(`[TwilioMedia] Sent ${chunkCount} audio chunks to Twilio`);

      // Send a mark to know when playback finishes
      const markName = `speech_${++this.markCounter}`;
      this.ws.send(JSON.stringify({
        event: "mark",
        streamSid: this.streamSid,
        mark: { name: markName },
      }));
      console.log(`[TwilioMedia] Sent mark: ${markName}, waiting for playback completion...`);

      // Wait for mark callback (playback complete)
      await this.waitForMark(markName);
      console.log(`[TwilioMedia] Mark received, audio playback complete`);
    } catch (error) {
      console.error("TTS/playback error:", error);
    } finally {
      this.isSpeaking = false;
    }
  }

  /**
   * Send a simple message using Twilio's native TTS (fallback)
   */
  private sendAudioMessage(text: string): void {
    // This is a fallback - in the media stream, we can't use <Say>
    // Instead we synthesize and send audio. If TTS fails, log error.
    this.speak(text).catch((err) => {
      console.error("Failed to send audio message:", err);
    });
  }

  /**
   * Interrupt current playback (barge-in support)
   */
  private interruptPlayback(): void {
    if (!this.streamSid || !this.isSpeaking) return;

    console.log("Interrupting playback (barge-in)");
    this.ws.send(JSON.stringify({
      event: "clear",
      streamSid: this.streamSid,
    }));
    this.isSpeaking = false;
  }

  // ============================================
  // Mark Handling
  // ============================================

  private markResolvers = new Map<string, () => void>();

  private handleMark(name: string): void {
    console.log(`[TwilioMedia] Received mark: ${name}`);
    const resolver = this.markResolvers.get(name);
    if (resolver) {
      resolver();
      this.markResolvers.delete(name);
    } else {
      console.log(`[TwilioMedia] No resolver found for mark: ${name}`);
    }
  }

  private waitForMark(name: string): Promise<void> {
    return new Promise((resolve) => {
      this.markResolvers.set(name, resolve);

      // Timeout after 30 seconds (safety net)
      setTimeout(() => {
        if (this.markResolvers.has(name)) {
          this.markResolvers.delete(name);
          resolve();
        }
      }, 30000);
    });
  }

  // ============================================
  // Call Lifecycle
  // ============================================

  private async endCall(): Promise<void> {
    try {
      // Update call record
      await query(
        `UPDATE calls SET
          status = 'completed',
          ended_at = NOW(),
          duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::int,
          transcript = $1,
          metadata = metadata || $2::jsonb
         WHERE id = $3`,
        [
          this.conversationHistory.map((m) => `${m.role}: ${m.content}`).join("\n"),
          JSON.stringify({ turnCount: this.turnCount, variables: this.variables }),
          this.config.callId,
        ]
      );
    } catch (error) {
      console.error("Failed to update call record:", error);
    }

    this.cleanup();
  }

  private async logEvent(eventType: string, metadata: Record<string, unknown>): Promise<void> {
    try {
      await query(
        `INSERT INTO call_events (call_id, event_type, metadata, timestamp)
         VALUES ($1, $2, $3, NOW())`,
        [this.config.callId, eventType, JSON.stringify(metadata)]
      );
    } catch (error) {
      console.error("Failed to log event:", error);
    }
  }

  private cleanup(): void {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
    if (this.sttConnection) {
      this.sttConnection.close();
      this.sttConnection = null;
    }
    this.markResolvers.clear();
  }
}

/**
 * Handle an incoming Twilio Media Stream WebSocket connection
 */
export function handleTwilioMediaStream(ws: WebSocket, config: MediaStreamConfig): void {
  new TwilioMediaStreamHandler(ws, config);
}
