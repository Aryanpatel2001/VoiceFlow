import type { SinglePromptConfig } from "./types";

export const DEFAULT_SINGLE_PROMPT_CONFIG: SinglePromptConfig = {
  version: 1,
  prompt:
    "You are a helpful voice assistant. Be concise, accurate, and polite. Ask one question at a time when needed.",
  sections: {
    identity: "",
    style: "",
    guidelines: "",
    tasks: "",
  },
  beginMessage: "Hello! How can I help you today?",
  beginMessageMode: "static",
  voice: "Rachel",
  voiceSpeed: 1,
  model: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: 300,
  responsiveness: 0.5,
  interruptionSensitivity: 0.5,
  enableBackchannel: false,
  backchannelWords: ["Got it", "Okay", "Understood"],
  endCallAfterSilenceMs: 30000,
  maxCallDurationMs: 600000,
  reminderMessage: "Are you still there?",
  reminderTriggerMs: 15000,
  reminderMaxCount: 1,
  ambientSound: "none",
  normalizeForSpeech: true,
  boostedKeywords: [],
  tools: [{ type: "end_call", description: "End the call when task is complete" }],
};

export function mergeSinglePromptConfig(
  partial?: Partial<SinglePromptConfig>
): SinglePromptConfig {
  return {
    ...DEFAULT_SINGLE_PROMPT_CONFIG,
    ...partial,
    sections: {
      ...DEFAULT_SINGLE_PROMPT_CONFIG.sections,
      ...(partial?.sections || {}),
    },
    tools: partial?.tools || DEFAULT_SINGLE_PROMPT_CONFIG.tools,
  };
}
