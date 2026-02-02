/**
 * Voice Pipeline Module
 *
 * Exports all voice-related services for AI voice conversations.
 *
 * @module lib/voice
 * @see docs/features/04-voice-pipeline.md
 */

// Configuration
export {
  getVoiceConfig,
  isVoiceConfigured,
  DEFAULT_VOICE_SETTINGS,
  AGENT_PROMPTS,
  type VoiceConfig,
} from "./config";

// LiveKit - Room & Token Management
export {
  generateToken,
  createRoom,
  getRoom,
  listRooms,
  deleteRoom,
  getParticipants,
  removeParticipant,
  generateRoomName,
  getServerUrl,
  type TokenOptions,
  type RoomOptions,
  type RoomInfo,
  type ParticipantDetails,
} from "./livekit";

// Deepgram - Speech-to-Text
export {
  createTranscriptionStream,
  transcribeAudio,
  type TranscriptResult,
  type DeepgramStreamOptions,
} from "./deepgram";

// OpenAI - LLM
export {
  generateResponse,
  streamResponse,
  streamSentences,
  detectIntent,
  analyzeSentiment,
  buildConversationMessages,
  type Message,
  type GenerateOptions,
  type StreamChunk,
} from "./openai";

// ElevenLabs - Text-to-Speech
export {
  synthesizeSpeech,
  synthesizeSpeechPCM,
  synthesizeSpeechMulaw,
  streamSpeech,
  getVoices,
  PRESET_VOICES,
  type TTSOptions,
  type Voice,
} from "./elevenlabs";

// Voice Agent
export {
  VoiceAgent,
  createVoiceAgent,
  generateAgentResponse,
  type AgentConfig,
  type AgentState,
} from "./agent";

// Flow-Aware Voice Agent
export {
  FlowVoiceAgent,
  createFlowAgent,
  type FlowAgentConfig,
  type FlowAgentState,
  type CallSummary,
} from "./flow-agent";

// Twilio Media Stream
export {
  TwilioMediaStreamHandler,
  handleTwilioMediaStream,
  type MediaStreamConfig,
} from "./twilio-media-stream";
