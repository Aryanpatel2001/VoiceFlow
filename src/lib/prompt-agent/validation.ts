import { z } from "zod";
import type { SinglePromptConfig } from "./types";

const transferToolSchema = z.object({
  type: z.literal("transfer_call"),
  description: z.string().optional(),
  destination: z.string().min(3),
  transferType: z.enum(["cold", "warm"]),
});

const httpToolSchema = z.object({
  type: z.literal("http"),
  name: z.string().min(1),
  description: z.string().min(1),
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  headers: z.record(z.string(), z.string()).optional(),
  bodyTemplate: z.string().optional(),
});

const checkAvailabilityToolSchema = z.object({
  type: z.literal("check_availability"),
  description: z.string().optional(),
  provider: z.literal("google_calendar"),
  calendarId: z.string().optional(),
  timezone: z.string().optional(),
  defaultDurationMinutes: z.number().int().min(5).max(240).optional(),
});

const bookSlotToolSchema = z.object({
  type: z.literal("book_slot"),
  description: z.string().optional(),
  provider: z.literal("google_calendar"),
  calendarId: z.string().optional(),
  timezone: z.string().optional(),
  defaultDurationMinutes: z.number().int().min(5).max(240).optional(),
});

const integrationToolSchema = z.object({
  type: z.literal("integration"),
  provider: z.string().min(1),
  actionId: z.string().min(1),
  description: z.string().optional(),
  inputMappings: z.record(z.string(), z.string()).optional(),
});

const endCallToolSchema = z.object({
  type: z.literal("end_call"),
  description: z.string().optional(),
});

const toolSchema = z.discriminatedUnion("type", [
  endCallToolSchema,
  transferToolSchema,
  checkAvailabilityToolSchema,
  bookSlotToolSchema,
  httpToolSchema,
  integrationToolSchema,
]);

export const singlePromptConfigSchema = z.object({
  version: z.number().int().min(1),
  prompt: z.string().trim().min(1),
  sections: z
    .object({
      identity: z.string().optional(),
      style: z.string().optional(),
      guidelines: z.string().optional(),
      tasks: z.string().optional(),
    })
    .optional(),
  beginMessage: z.string().optional(),
  beginMessageMode: z.enum(["static", "prompt"]),
  voice: z.string().min(1),
  voiceSpeed: z.number().min(0.5).max(2).optional(),
  model: z.enum(["gpt-4o-mini", "gpt-4o"]),
  temperature: z.number().min(0).max(1),
  maxTokens: z.number().int().min(1).max(2048).optional(),
  responsiveness: z.number().min(0).max(1),
  interruptionSensitivity: z.number().min(0).max(1),
  enableBackchannel: z.boolean(),
  backchannelWords: z.array(z.string()).optional(),
  endCallAfterSilenceMs: z.number().int().min(3000).max(120000),
  maxCallDurationMs: z.number().int().min(30000).max(4 * 60 * 60 * 1000),
  reminderMessage: z.string().optional(),
  reminderTriggerMs: z.number().int().min(1000).max(120000).optional(),
  reminderMaxCount: z.number().int().min(0).max(5).optional(),
  ambientSound: z.enum(["office", "cafe", "none"]).optional(),
  normalizeForSpeech: z.boolean(),
  boostedKeywords: z.array(z.string()).optional(),
  tools: z.array(toolSchema).default([]),
});

export function validateSinglePromptConfig(config: unknown): {
  valid: boolean;
  errors: string[];
} {
  const parsed = singlePromptConfigSchema.safeParse(config);
  if (parsed.success) {
    return { valid: true, errors: [] };
  }
  const errors = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  return { valid: false, errors };
}
