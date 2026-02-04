/**
 * Voice Store
 *
 * Zustand store for managing voice call state in the browser.
 * Handles LiveKit connection, transcripts, and UI state.
 *
 * @module stores/voice
 */

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrackPublication,
  ConnectionState,
  Participant,
} from "livekit-client";

// Types
export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

export interface TranscriptEntry {
  id: string;
  speaker: "user" | "agent";
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

interface VoiceState {
  // Connection
  connectionStatus: ConnectionStatus;
  room: Room | null;
  roomName: string | null;
  serverUrl: string | null;
  error: string | null;

  // Audio state
  isAgentSpeaking: boolean;
  isUserSpeaking: boolean;
  isMuted: boolean;
  audioLevel: number;

  // Transcript
  transcript: TranscriptEntry[];

  // Call info
  callStartTime: Date | null;
  callDuration: number;
}

interface VoiceActions {
  // Connection
  connect: (token: string, serverUrl: string, roomName: string) => Promise<void>;
  disconnect: () => Promise<void>;

  // Audio
  toggleMute: () => void;
  setAudioLevel: (level: number) => void;
  setAgentSpeaking: (speaking: boolean) => void;
  setUserSpeaking: (speaking: boolean) => void;

  // Transcript
  addTranscript: (entry: Omit<TranscriptEntry, "id" | "timestamp">) => void;
  updateTranscript: (id: string, text: string, isFinal: boolean) => void;
  clearTranscript: () => void;

  // State
  setError: (error: string | null) => void;
  reset: () => void;

  // Timer
  updateCallDuration: () => void;
}

const initialState: VoiceState = {
  connectionStatus: "disconnected",
  room: null,
  roomName: null,
  serverUrl: null,
  error: null,
  isAgentSpeaking: false,
  isUserSpeaking: false,
  isMuted: false,
  audioLevel: 0,
  transcript: [],
  callStartTime: null,
  callDuration: 0,
};

export const useVoiceStore = create<VoiceState & VoiceActions>((set, get) => ({
  ...initialState,

  connect: async (token: string, serverUrl: string, roomName: string) => {
    const { room: existingRoom } = get();

    console.log("🎙️ [VoiceStore] Connecting to room:", roomName);
    console.log("🔗 [VoiceStore] Server URL:", serverUrl);

    // Disconnect existing room if any
    if (existingRoom) {
      await existingRoom.disconnect();
    }

    set({
      connectionStatus: "connecting",
      error: null,
      roomName,
      serverUrl,
    });

    try {
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Setup event listeners
      setupRoomEvents(room, set, get);

      // Connect to room
      await room.connect(serverUrl, token);

      // Enable microphone
      await room.localParticipant.setMicrophoneEnabled(true);

      console.log("✅ [VoiceStore] Connected successfully!");
      console.log("🎤 [VoiceStore] Microphone enabled, ready to speak");

      set({
        room,
        connectionStatus: "connected",
        callStartTime: new Date(),
      });
    } catch (error) {
      console.error("❌ [VoiceStore] Failed to connect:", error);
      set({
        connectionStatus: "failed",
        error: error instanceof Error ? error.message : "Failed to connect",
      });
      throw error;
    }
  },

  disconnect: async () => {
    const { room, transcript } = get();

    console.log("📞 [VoiceStore] Ending call...");
    console.log("📝 [VoiceStore] Final transcript:");
    transcript.forEach((t) => {
      const speaker = t.speaker === "user" ? "👤 USER" : "🤖 AGENT";
      console.log(`   ${speaker}: ${t.text}`);
    });

    if (room) {
      await room.disconnect();
    }
    console.log("👋 [VoiceStore] Disconnected");

    set({
      ...initialState,
    });
  },

  toggleMute: () => {
    const { room, isMuted } = get();
    if (room?.localParticipant) {
      room.localParticipant.setMicrophoneEnabled(isMuted);
      set({ isMuted: !isMuted });
    }
  },

  setAudioLevel: (level: number) => {
    set({ audioLevel: level });
  },

  setAgentSpeaking: (speaking: boolean) => {
    set({ isAgentSpeaking: speaking });
  },

  setUserSpeaking: (speaking: boolean) => {
    set({ isUserSpeaking: speaking });
  },

  addTranscript: (entry) => {
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();

    // Log the transcript entry
    const speaker = entry.speaker === "user" ? "👤 USER" : "🤖 AGENT";
    console.log(`[${timestamp.toLocaleTimeString()}] ${speaker}: ${entry.text}`);

    set((state) => ({
      transcript: [
        ...state.transcript,
        {
          ...entry,
          id,
          timestamp,
        },
      ],
    }));
  },

  updateTranscript: (id: string, text: string, isFinal: boolean) => {
    set((state) => ({
      transcript: state.transcript.map((t) =>
        t.id === id ? { ...t, text, isFinal } : t
      ),
    }));
  },

  clearTranscript: () => {
    set({ transcript: [] });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  reset: () => {
    const { room } = get();
    if (room) {
      room.disconnect();
    }
    set({ ...initialState });
  },

  updateCallDuration: () => {
    const { callStartTime, connectionStatus } = get();
    if (callStartTime && connectionStatus === "connected") {
      const duration = Math.floor(
        (Date.now() - callStartTime.getTime()) / 1000
      );
      set({ callDuration: duration });
    }
  },
}));

/**
 * Setup room event listeners
 */
function setupRoomEvents(
  room: Room,
  set: (partial: Partial<VoiceState>) => void,
  get: () => VoiceState & VoiceActions
) {
  // Connection state changes
  room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
    switch (state) {
      case ConnectionState.Connected:
        set({ connectionStatus: "connected" });
        break;
      case ConnectionState.Reconnecting:
        set({ connectionStatus: "reconnecting" });
        break;
      case ConnectionState.Disconnected:
        set({ connectionStatus: "disconnected" });
        break;
    }
  });

  // Handle disconnection
  room.on(RoomEvent.Disconnected, () => {
    set({ connectionStatus: "disconnected" });
  });

  // Track audio levels
  room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
    const hasAgent = speakers.some(
      (s) => s.metadata?.includes('"isAgent":true')
    );
    const hasUser = speakers.some(
      (s) => !s.metadata?.includes('"isAgent":true')
    );

    if (hasUser) {
      console.log("🎤 [VoiceStore] User is speaking...");
    }

    if (hasAgent) {
      console.log("🔊 [VoiceStore] Agent is speaking...");
    }

    set({
      isAgentSpeaking: hasAgent,
      isUserSpeaking: hasUser,
    });
  });

  // Handle new participants
  room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
    console.log(`Participant connected: ${participant.identity}`);
  });

  // Handle participant leaving
  room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
    console.log(`Participant disconnected: ${participant.identity}`);
  });

  // Handle track subscribed
  room.on(
    RoomEvent.TrackSubscribed,
    (track: Track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (track.kind === Track.Kind.Audio) {
        console.log(`Subscribed to audio from: ${participant.identity}`);
        // Audio will automatically play through default output
      }
    }
  );

  // Handle data messages (for transcript updates from agent)
  room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(payload));
      console.log("📨 [VoiceStore] Data received:", data);
      if (data.type === "transcript") {
        get().addTranscript({
          speaker: data.speaker || "agent",
          text: data.text,
          isFinal: data.isFinal ?? true,
        });
      }
    } catch {
      // Ignore non-JSON messages
    }
  });
}

/**
 * Hook for call duration timer
 */
export function useCallDurationTimer() {
  const updateCallDuration = useVoiceStore((s) => s.updateCallDuration);
  const connectionStatus = useVoiceStore((s) => s.connectionStatus);

  // This should be called in a useEffect with setInterval
  return { updateCallDuration, isConnected: connectionStatus === "connected" };
}

/**
 * Selector for transcript (memoized)
 */
export function useTranscript() {
  return useVoiceStore((s) => s.transcript);
}

/**
 * Selector for connection state
 */
export function useConnectionState() {
  return useVoiceStore(
    useShallow((s) => ({
      status: s.connectionStatus,
      error: s.error,
      roomName: s.roomName,
    }))
  );
}

/**
 * Selector for audio state
 */
export function useAudioState() {
  return useVoiceStore(
    useShallow((s) => ({
      isAgentSpeaking: s.isAgentSpeaking,
      isUserSpeaking: s.isUserSpeaking,
      isMuted: s.isMuted,
      audioLevel: s.audioLevel,
    }))
  );
}