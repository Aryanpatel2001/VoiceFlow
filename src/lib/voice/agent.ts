/**
 * Voice AI Agent
 *
 * Core agent that connects to LiveKit rooms and processes
 * voice conversations through the STT → LLM → TTS pipeline.
 *
 * @module lib/voice/agent
 */

import { Room, RoomEvent, RemoteParticipant, RemoteTrackPublication, Track, LocalAudioTrack } from "@livekit/rtc-node";
import type { TrackKind } from "@livekit/rtc-node";
import { createTranscriptionStream, TranscriptResult } from "./deepgram";
import { generateResponse, Message, buildConversationMessages, streamSentences } from "./openai";
import { synthesizeSpeech } from "./elevenlabs";
import { generateToken, getServerUrl } from "./livekit";
import { AGENT_PROMPTS } from "./config";

// Types
export interface AgentConfig {
  roomName: string;
  agentName?: string;
  systemPrompt?: string;
  voiceId?: string;
  onTranscript?: (speaker: "user" | "agent", text: string) => void;
  onStateChange?: (state: AgentState) => void;
  onError?: (error: Error) => void;
}

export type AgentState =
  | "initializing"
  | "connected"
  | "listening"
  | "processing"
  | "speaking"
  | "disconnected"
  | "error";

interface TranscriptEntry {
  speaker: "user" | "agent";
  text: string;
  timestamp: Date;
}

/**
 * VoiceAgent class
 * Manages the full lifecycle of a voice AI agent in a LiveKit room
 */
export class VoiceAgent {
  private room: Room;
  private config: AgentConfig;
  private state: AgentState = "initializing";
  private transcript: TranscriptEntry[] = [];
  private sttConnection: Awaited<ReturnType<typeof createTranscriptionStream>> | null = null;
  private isProcessing = false;
  private pendingUserText = "";
  private silenceTimeout: NodeJS.Timeout | null = null;
  private audioTrack: LocalAudioTrack | null = null;

  constructor(config: AgentConfig) {
    this.config = {
      agentName: "AI Assistant",
      systemPrompt: AGENT_PROMPTS.default,
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

      // Generate agent token
      const token = await generateToken({
        roomName: this.config.roomName,
        participantName: this.config.agentName!,
        participantIdentity: `agent_${Date.now()}`,
        isAgent: true,
        metadata: JSON.stringify({ isAgent: true }),
      });

      // Connect to room
      const serverUrl = getServerUrl();
      await this.room.connect(serverUrl, token);

      this.setState("connected");
      console.log(`Agent connected to room: ${this.config.roomName}`);

      // Start listening for audio
      await this.startListening();
    } catch (error) {
      this.setState("error");
      this.config.onError?.(
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Disconnect from the room and cleanup
   */
  async disconnect(): Promise<void> {
    try {
      this.stopListening();
      await this.room.disconnect();
      this.setState("disconnected");
      console.log("Agent disconnected");
    } catch (error) {
      console.error("Error disconnecting agent:", error);
    }
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return this.state;
  }

  /**
   * Get conversation transcript
   */
  getTranscript(): TranscriptEntry[] {
    return [...this.transcript];
  }

  /**
   * Setup room event handlers
   */
  private setupRoomEvents(): void {
    // Handle participant connected
    this.room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log(`Participant connected: ${participant.identity}`);
      this.subscribeToParticipant(participant);
    });

    // Handle participant disconnected
    this.room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.log(`Participant disconnected: ${participant.identity}`);
    });

    // Handle track subscribed
    this.room.on(
      RoomEvent.TrackSubscribed,
      (track: Track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind === ("audio" as unknown as TrackKind)) {
          console.log(`Subscribed to audio from: ${participant.identity}`);
          this.handleAudioTrack(track, participant);
        }
      }
    );

    // Handle connection state changes
    this.room.on(RoomEvent.Disconnected, () => {
      this.setState("disconnected");
    });

    this.room.on(RoomEvent.Reconnecting, () => {
      console.log("Reconnecting to room...");
    });

    this.room.on(RoomEvent.Reconnected, () => {
      console.log("Reconnected to room");
      this.setState("connected");
    });
  }

  /**
   * Subscribe to a participant's tracks
   */
  private subscribeToParticipant(participant: RemoteParticipant): void {
    // Skip if this is another agent
    if (participant.metadata?.includes('"isAgent":true')) {
      return;
    }

    // Subscribe to existing tracks
    participant.trackPublications.forEach((publication) => {
      if (publication.track && publication.track.kind === ("audio" as unknown as TrackKind)) {
        this.handleAudioTrack(publication.track, participant);
      }
    });
  }

  /**
   * Handle incoming audio track from a participant
   */
  private handleAudioTrack(track: Track, participant: RemoteParticipant): void {
    console.log(`Processing audio from: ${participant.identity}`);

    // The track is an AudioTrack, we need to get audio frames from it
    // In @livekit/rtc-node, we use AudioStream to receive frames
    // For now, we'll implement a simplified version

    // Note: Full implementation would use AudioStream from @livekit/rtc-node
    // to receive audio frames and pipe them to Deepgram
  }

  /**
   * Start the speech-to-text stream
   */
  private async startListening(): Promise<void> {
    try {
      this.sttConnection = await createTranscriptionStream(
        (result) => this.handleTranscript(result),
        (error) => this.handleSTTError(error)
      );
      this.setState("listening");
      console.log("STT stream started");
    } catch (error) {
      console.error("Failed to start STT:", error);
      this.config.onError?.(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Stop the speech-to-text stream
   */
  private stopListening(): void {
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
   * Handle transcription results from Deepgram
   */
  private handleTranscript(result: TranscriptResult): void {
    if (!result.text.trim()) return;

    if (result.isFinal) {
      // Accumulate final transcripts
      this.pendingUserText += " " + result.text;
      this.pendingUserText = this.pendingUserText.trim();

      // Reset silence timeout
      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
      }

      // Wait for a pause before processing
      this.silenceTimeout = setTimeout(() => {
        if (this.pendingUserText && !this.isProcessing) {
          this.processUserInput(this.pendingUserText);
          this.pendingUserText = "";
        }
      }, 1000); // 1 second of silence triggers response

      // Notify listeners
      this.config.onTranscript?.("user", result.text);
    }
  }

  /**
   * Handle STT errors
   */
  private handleSTTError(error: Error): void {
    console.error("STT error:", error);
    this.config.onError?.(error);

    // Try to reconnect STT
    setTimeout(() => {
      if (this.state !== "disconnected") {
        this.startListening();
      }
    }, 1000);
  }

  /**
   * Process user input through LLM and generate response
   */
  private async processUserInput(userText: string): Promise<void> {
    if (this.isProcessing) return;

    try {
      this.isProcessing = true;
      this.setState("processing");

      // Add to transcript
      this.addToTranscript("user", userText);

      // Build conversation context
      const messages = buildConversationMessages(
        this.transcript.map((t) => ({
          speaker: t.speaker,
          text: t.text,
        }))
      );

      // Generate response using streaming for lower latency
      let fullResponse = "";

      for await (const sentence of streamSentences(messages, {
        systemPrompt: this.config.systemPrompt,
      })) {
        fullResponse += sentence + " ";

        // Speak each sentence as it's generated
        await this.speak(sentence);
      }

      // Add agent response to transcript
      this.addToTranscript("agent", fullResponse.trim());
      this.config.onTranscript?.("agent", fullResponse.trim());

      this.setState("listening");
    } catch (error) {
      console.error("Error processing user input:", error);
      this.config.onError?.(
        error instanceof Error ? error : new Error(String(error))
      );
      this.setState("listening");
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Convert text to speech and play through LiveKit
   */
  private async speak(text: string): Promise<void> {
    try {
      this.setState("speaking");

      // Generate audio
      const audioBuffer = await synthesizeSpeech(text, {
        voiceId: this.config.voiceId,
      });

      // In a full implementation, we would:
      // 1. Decode the MP3 audio to PCM
      // 2. Create audio frames
      // 3. Publish to the room via LocalAudioTrack
      //
      // For now, this is a placeholder for the audio publishing logic
      // The @livekit/rtc-node SDK provides AudioSource for this purpose

      console.log(`Speaking: "${text}" (${audioBuffer.length} bytes)`);

      // Simulate speaking duration based on text length
      // Roughly 150 words per minute = 2.5 words per second
      const words = text.split(" ").length;
      const duration = Math.max(500, (words / 2.5) * 1000);
      await new Promise((resolve) => setTimeout(resolve, duration));
    } catch (error) {
      console.error("Error speaking:", error);
      throw error;
    }
  }

  /**
   * Add entry to transcript
   */
  private addToTranscript(speaker: "user" | "agent", text: string): void {
    this.transcript.push({
      speaker,
      text,
      timestamp: new Date(),
    });
  }

  /**
   * Update agent state
   */
  private setState(state: AgentState): void {
    this.state = state;
    this.config.onStateChange?.(state);
  }
}

/**
 * Create and start a voice agent for a room
 */
export async function createVoiceAgent(
  config: AgentConfig
): Promise<VoiceAgent> {
  const agent = new VoiceAgent(config);
  await agent.connect();
  return agent;
}

/**
 * Simple function to generate a text response (for API use)
 */
export async function generateAgentResponse(
  userMessage: string,
  conversationHistory: Message[] = [],
  systemPrompt?: string
): Promise<string> {
  const messages: Message[] = [
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  return generateResponse(messages, {
    systemPrompt: systemPrompt || AGENT_PROMPTS.default,
  });
}
