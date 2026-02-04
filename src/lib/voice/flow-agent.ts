/**
 * Flow-Aware Voice Agent
 *
 * Executes published flows during voice conversations via LiveKit.
 * Wires STT (Deepgram) ← user audio ← LiveKit room → agent audio → TTS (ElevenLabs).
 *
 * @module lib/voice/flow-agent
 */

import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  LocalAudioTrack,
  AudioSource,
  AudioFrame,
  AudioStream,
  TrackPublishOptions,
} from "@livekit/rtc-node";
import { createTranscriptionStream, TranscriptResult } from "./deepgram";
import { synthesizeSpeechPCM } from "./elevenlabs";
import { generateToken, getServerUrl } from "./livekit";
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

export interface FlowAgentConfig {
  roomName: string;
  flowId?: string;
  webhookId?: string;
  agentName?: string;
  voiceId?: string;
  callId?: string;
  callerNumber?: string;
  onTranscript?: (speaker: "user" | "agent", text: string) => void;
  onStateChange?: (state: FlowAgentState) => void;
  onCallEnd?: (summary: CallSummary) => void;
  onError?: (error: Error) => void;
}

export type FlowAgentState =
  | "initializing"
  | "connected"
  | "greeting"
  | "listening"
  | "processing"
  | "speaking"
  | "transferring"
  | "ending"
  | "disconnected"
  | "error";

export interface CallSummary {
  duration: number;
  turnCount: number;
  transcript: Array<{ speaker: string; text: string; timestamp: Date }>;
  intent?: string;
  outcome?: string;
  extractedData: Record<string, unknown>;
}

// ============================================
// Constants
// ============================================

const AUDIO_SAMPLE_RATE = 24000; // 24kHz for TTS output
const AUDIO_CHANNELS = 1;
const STT_SAMPLE_RATE = 16000; // 16kHz for Deepgram input
const FRAME_DURATION_MS = 20; // 20ms audio frames

// ============================================
// FlowVoiceAgent
// ============================================

/**
 * FlowVoiceAgent class
 * Executes published flows during voice conversations
 */
export class FlowVoiceAgent {
  private room: Room;
  private config: FlowAgentConfig;
  private state: FlowAgentState = "initializing";
  private transcript: Array<{ speaker: "user" | "agent"; text: string; timestamp: Date }> = [];
  private sttConnection: Awaited<ReturnType<typeof createTranscriptionStream>> | null = null;
  private isProcessing = false;
  private pendingUserText = "";
  private silenceTimeout: NodeJS.Timeout | null = null;
  private startTime: Date = new Date();

  // Audio pipeline
  private audioSource: AudioSource | null = null;
  private localAudioTrack: LocalAudioTrack | null = null;
  private audioStream: AudioStream | null = null;
  private audioStreamAbort: AbortController | null = null;

  // Flow execution state
  private flowNodes: FlowNodeData[] = [];
  private flowEdges: FlowEdgeData[] = [];
  private currentNodeId = "";
  private variables: Record<string, unknown> = {};
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private turnCount = 0;

  constructor(config: FlowAgentConfig) {
    this.config = {
      agentName: "AI Assistant",
      ...config,
    };
    this.room = new Room();
    this.setupRoomEvents();
  }

  /**
   * Connect to the LiveKit room and start the agent
   */
  async connect(): Promise<void> {
    try {
      this.setState("initializing");
      this.startTime = new Date();

      // Load flow data
      await this.loadFlowData();

      // Create audio source for TTS output
      this.audioSource = new AudioSource(AUDIO_SAMPLE_RATE, AUDIO_CHANNELS);

      // Create local audio track from source
      this.localAudioTrack = LocalAudioTrack.createAudioTrack("agent-voice", this.audioSource);

      // Generate agent token
      const token = await generateToken({
        roomName: this.config.roomName,
        participantName: this.config.agentName!,
        participantIdentity: `agent_${Date.now()}`,
        isAgent: true,
        metadata: JSON.stringify({ isAgent: true, flowId: this.config.flowId }),
      });

      // Connect to room
      const serverUrl = getServerUrl();
      await this.room.connect(serverUrl, token);

      // Publish agent audio track
      if (this.room.localParticipant && this.localAudioTrack) {
        await this.room.localParticipant.publishTrack(
          this.localAudioTrack,
          new TrackPublishOptions()
        );
        console.log("Agent audio track published");
      }

      this.setState("connected");
      console.log(`Flow agent connected to room: ${this.config.roomName}`);

      // Execute start node (greeting)
      await this.executeStartNode();

      // Start listening for user audio via STT
      await this.startSTT();
    } catch (error) {
      this.setState("error");
      this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Load flow data from database
   */
  private async loadFlowData(): Promise<void> {
    if (!this.config.webhookId) {
      throw new Error("webhookId is required for flow agent");
    }

    const flow = await getFlowByWebhookId(this.config.webhookId);

    if (!flow) {
      throw new Error(`Flow not found for webhook: ${this.config.webhookId}`);
    }

    // Get published version
    const publishedVersion = await getPublishedFlowVersion(flow.id);
    const flowData = publishedVersion?.flowData || flow.flowData;

    this.flowNodes = flowData.nodes as FlowNodeData[];
    this.flowEdges = flowData.edges as FlowEdgeData[];

    // Initialize variables
    this.variables = initializeVariables(flowData.variables);

    // Find start node
    this.currentNodeId = findStartNode(this.flowNodes);

    console.log(`Flow loaded: ${this.flowNodes.length} nodes, starting at ${this.currentNodeId}`);
  }

  /**
   * Execute the start node (greeting)
   */
  private async executeStartNode(): Promise<void> {
    const startNode = this.flowNodes.find((n) => n.type === "start");
    if (!startNode) return;

    this.setState("greeting");

    const config = (startNode.data as { config?: Record<string, unknown> })?.config || {};
    const greeting = (config.greeting as string) || "Hello! How can I help you today?";

    // Speak the greeting
    await this.speak(greeting);
    this.addToTranscript("agent", greeting);

    // Move to next node
    const nextNodeId = findNextNode(this.flowEdges, startNode.id, "default");
    if (nextNodeId) {
      this.currentNodeId = nextNodeId;
    }
  }

  /**
   * Disconnect from the room and cleanup
   */
  async disconnect(): Promise<void> {
    try {
      this.stopSTT();
      this.stopAudioStream();

      // Generate call summary
      const summary: CallSummary = {
        duration: Date.now() - this.startTime.getTime(),
        turnCount: this.turnCount,
        transcript: this.transcript,
        intent: this.variables["intent"] as string | undefined,
        outcome: this.state === "ending" ? "completed" : "disconnected",
        extractedData: this.variables,
      };

      // Save call to database if callId exists
      if (this.config.callId) {
        await this.saveCallRecord(summary);
      }

      this.config.onCallEnd?.(summary);

      // Close audio track (without closing source) then close source
      if (this.localAudioTrack) {
        await this.localAudioTrack.close(false);
        this.localAudioTrack = null;
      }
      if (this.audioSource) {
        await this.audioSource.close();
        this.audioSource = null;
      }

      await this.room.disconnect();
      this.setState("disconnected");
      console.log("Flow agent disconnected");
    } catch (error) {
      console.error("Error disconnecting agent:", error);
    }
  }

  /**
   * Get current agent state
   */
  getState(): FlowAgentState {
    return this.state;
  }

  // ============================================
  // Room Events
  // ============================================

  private setupRoomEvents(): void {
    // When a user joins, subscribe to their audio
    this.room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        // Skip other agents
        if (participant.metadata?.includes('"isAgent":true')) {
          return;
        }

        // Subscribe to audio tracks
        if (track.kind?.toString() === "1" || publication.kind?.toString() === "1") {
          console.log(`Subscribed to user audio from: ${participant.identity}`);
          this.startAudioStream(track);
        }
      }
    );

    this.room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.log(`Participant disconnected: ${participant.identity}`);
      if (!participant.metadata?.includes('"isAgent":true')) {
        // User disconnected, end the call
        this.disconnect();
      }
    });

    this.room.on(RoomEvent.Disconnected, () => {
      this.setState("disconnected");
    });
  }

  // ============================================
  // Audio Pipeline: User → STT
  // ============================================

  /**
   * Start the Deepgram STT stream
   */
  private async startSTT(): Promise<void> {
    try {
      this.sttConnection = await createTranscriptionStream(
        (result) => this.handleTranscript(result),
        (error) => this.handleSTTError(error),
        { sampleRate: STT_SAMPLE_RATE, encoding: "linear16" }
      );
      this.setState("listening");
      console.log("STT stream started");
    } catch (error) {
      console.error("Failed to start STT:", error);
      this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private stopSTT(): void {
    if (this.sttConnection) {
      this.sttConnection.close();
      this.sttConnection = null;
    }
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }

  /**
   * Start streaming audio from a remote participant to Deepgram STT
   */
  private async startAudioStream(track: RemoteTrack): Promise<void> {
    this.stopAudioStream();

    try {
      // Create an AudioStream from the remote track at 16kHz for Deepgram
      this.audioStream = new AudioStream(track, STT_SAMPLE_RATE, AUDIO_CHANNELS);
      this.audioStreamAbort = new AbortController();

      console.log("Audio stream created from remote participant");

      // Read audio frames and pipe to Deepgram
      const reader = this.audioStream.getReader();
      const readFrames = async () => {
        try {
          while (!this.audioStreamAbort?.signal.aborted) {
            const { value: frame, done } = await reader.read();
            if (done) break;

            // Send PCM audio data to Deepgram
            if (frame && this.sttConnection?.isOpen()) {
              // AudioFrame.data is an Int16Array - convert to Buffer for Deepgram
              const buffer = Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength);
              this.sttConnection.send(buffer);
            }
          }
        } catch (error) {
          if (!this.audioStreamAbort?.signal.aborted) {
            console.error("Audio stream reading error:", error);
          }
        } finally {
          reader.releaseLock();
        }
      };

      // Start reading in background
      readFrames();
    } catch (error) {
      console.error("Failed to start audio stream:", error);
    }
  }

  private stopAudioStream(): void {
    if (this.audioStreamAbort) {
      this.audioStreamAbort.abort();
      this.audioStreamAbort = null;
    }
    this.audioStream = null;
  }

  /**
   * Handle transcription results from Deepgram
   */
  private handleTranscript(result: TranscriptResult): void {
    if (!result.text.trim()) return;

    if (result.isFinal) {
      this.pendingUserText += " " + result.text;
      this.pendingUserText = this.pendingUserText.trim();

      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
      }

      // Wait for pause before processing
      this.silenceTimeout = setTimeout(() => {
        if (this.pendingUserText && !this.isProcessing) {
          this.processUserInput(this.pendingUserText);
          this.pendingUserText = "";
        }
      }, 1000);

      this.config.onTranscript?.("user", result.text);
    }
  }

  private handleSTTError(error: Error): void {
    console.error("STT error:", error);
    this.config.onError?.(error);

    // Reconnect STT after error
    setTimeout(() => {
      if (this.state !== "disconnected") {
        this.startSTT();
      }
    }, 1000);
  }

  // ============================================
  // Audio Pipeline: Agent → TTS → LiveKit
  // ============================================

  /**
   * Speak text using TTS and publish audio to LiveKit room
   */
  private async speak(text: string): Promise<void> {
    if (!this.audioSource) {
      console.error("AudioSource not initialized");
      return;
    }

    try {
      this.setState("speaking");

      // Synthesize speech as PCM audio
      const { buffer: pcmBuffer, sampleRate } = await synthesizeSpeechPCM(text, {
        voiceId: this.config.voiceId,
        sampleRate: AUDIO_SAMPLE_RATE,
      });

      console.log(`Speaking: "${text}" (${pcmBuffer.length} bytes PCM @ ${sampleRate}Hz)`);

      // Convert PCM buffer to Int16Array
      const samples = new Int16Array(
        pcmBuffer.buffer,
        pcmBuffer.byteOffset,
        pcmBuffer.byteLength / 2
      );

      // Push audio in frames to AudioSource
      const samplesPerFrame = Math.floor((sampleRate * FRAME_DURATION_MS) / 1000);
      let offset = 0;

      while (offset < samples.length) {
        const end = Math.min(offset + samplesPerFrame, samples.length);
        const frameData = samples.slice(offset, end);

        const frame = new AudioFrame(
          frameData,
          sampleRate,
          AUDIO_CHANNELS,
          frameData.length
        );

        await this.audioSource.captureFrame(frame);
        offset = end;
      }

      // Wait for all audio to be played out
      await this.audioSource.waitForPlayout();
    } catch (error) {
      console.error("Error speaking:", error);
    }
  }

  // ============================================
  // Flow Execution
  // ============================================

  /**
   * Process user input through the flow using the shared execution engine
   */
  private async processUserInput(userText: string): Promise<void> {
    if (this.isProcessing) return;

    try {
      this.isProcessing = true;
      this.setState("processing");
      this.turnCount++;

      // Add to transcript
      this.addToTranscript("user", userText);
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

      // Apply result
      this.variables = result.variables;

      if (result.response) {
        await this.speak(result.response);
        this.addToTranscript("agent", result.response);
        this.conversationHistory.push({ role: "assistant", content: result.response });
      }

      // Handle action
      switch (result.action) {
        case "end":
          await this.disconnect();
          return;
        case "transfer":
          this.setState("transferring");
          console.log(`Transferring call to: ${result.transferTo}`);
          await this.disconnect();
          return;
        case "gather":
          if (result.nextNodeId) {
            this.currentNodeId = result.nextNodeId;
          }
          break;
      }

      this.setState("listening");
    } catch (error) {
      console.error("Error processing user input:", error);
      this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
      this.setState("listening");
    } finally {
      this.isProcessing = false;
    }
  }

  // ============================================
  // Helpers
  // ============================================

  private addToTranscript(speaker: "user" | "agent", text: string): void {
    this.transcript.push({ speaker, text, timestamp: new Date() });
    this.config.onTranscript?.(speaker, text);
  }

  private async saveCallRecord(summary: CallSummary): Promise<void> {
    try {
      await query(
        `UPDATE calls SET
          ended_at = NOW(),
          duration_seconds = $1,
          primary_intent = $2,
          outcome = $3,
          transcript = $4,
          metadata = metadata || $5::jsonb
         WHERE id = $6`,
        [
          Math.floor(summary.duration / 1000),
          summary.intent || null,
          summary.outcome || "completed",
          summary.transcript.map((t) => `${t.speaker}: ${t.text}`).join("\n"),
          JSON.stringify({ extractedData: summary.extractedData, turnCount: summary.turnCount }),
          this.config.callId,
        ]
      );
    } catch (error) {
      console.error("Failed to save call record:", error);
    }
  }

  private setState(state: FlowAgentState): void {
    this.state = state;
    this.config.onStateChange?.(state);
  }
}

/**
 * Create and start a flow-aware voice agent
 */
export async function createFlowAgent(config: FlowAgentConfig): Promise<FlowVoiceAgent> {
  const agent = new FlowVoiceAgent(config);
  await agent.connect();
  return agent;
}
