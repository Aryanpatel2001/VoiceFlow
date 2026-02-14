export type AgentMode = "canvas" | "single_prompt";

export interface PromptSections {
  identity?: string;
  style?: string;
  guidelines?: string;
  tasks?: string;
}

export type PromptAgentTool =
  | { type: "end_call"; description?: string }
  | {
      type: "transfer_call";
      description?: string;
      destination: string;
      transferType: "cold" | "warm";
    }
  | {
      type: "check_availability";
      description?: string;
      provider: "google_calendar";
      calendarId?: string;
      timezone?: string;
      defaultDurationMinutes?: number;
    }
  | {
      type: "book_slot";
      description?: string;
      provider: "google_calendar";
      calendarId?: string;
      timezone?: string;
      defaultDurationMinutes?: number;
    }
  | {
      type: "http";
      name: string;
      description: string;
      url: string;
      method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      headers?: Record<string, string>;
      bodyTemplate?: string;
    }
  | {
      type: "integration";
      provider: string;
      actionId: string;
      description?: string;
      inputMappings?: Record<string, string>;
    };

export interface SinglePromptConfig {
  version: number;
  prompt: string;
  sections?: PromptSections;

  beginMessage?: string;
  beginMessageMode: "static" | "prompt";

  voice: string;
  voiceSpeed?: number;
  model: "gpt-4o-mini" | "gpt-4o";
  temperature: number;
  maxTokens?: number;

  responsiveness: number;
  interruptionSensitivity: number;
  enableBackchannel: boolean;
  backchannelWords?: string[];

  endCallAfterSilenceMs: number;
  maxCallDurationMs: number;
  reminderMessage?: string;
  reminderTriggerMs?: number;
  reminderMaxCount?: number;

  ambientSound?: "office" | "cafe" | "none";
  normalizeForSpeech: boolean;
  boostedKeywords?: string[];

  tools: PromptAgentTool[];
}

export interface PromptTurnResult {
  response: string;
  action: "speak" | "transfer" | "end" | "gather";
  variables: Record<string, unknown>;
  transferTo?: string;
  transferType?: "cold" | "warm";
}
