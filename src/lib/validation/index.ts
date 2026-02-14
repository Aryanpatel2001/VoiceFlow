/**
 * API Validation Library
 *
 * Centralized Zod schemas and validation utilities for API routes.
 * Compatible with Zod v4.
 */

import { z } from "zod";
import { NextResponse } from "next/server";

// ============================================
// Common Schemas
// ============================================

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).max(10000).optional().default(0),
});

/**
 * Enforce pagination bounds on raw values
 * Use this to sanitize pagination params from untrusted sources
 */
export function enforcePaginationBounds(
  limit?: number,
  offset?: number
): { limit: number; offset: number } {
  return {
    limit: Math.max(1, Math.min(100, limit ?? 20)),
    offset: Math.max(0, Math.min(10000, offset ?? 0)),
  };
}

export const orderingSchema = z.object({
  orderBy: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// ============================================
// Flow Schemas
// ============================================

export const flowStatusSchema = z.enum(["draft", "published"]);

export const flowNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const flowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const flowVariableSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["string", "number", "boolean", "array", "object"]),
  defaultValue: z.unknown().optional(),
});

export const agentModeSchema = z.enum(["canvas", "single_prompt"]);

export const createFlowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  templateId: z.string().optional(),
  agentMode: agentModeSchema.optional(),
  nodes: z.array(flowNodeSchema).optional(),
  edges: z.array(flowEdgeSchema).optional(),
  variables: z.array(flowVariableSchema).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const updateFlowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  agentMode: agentModeSchema.optional(),
  nodes: z.array(flowNodeSchema).optional(),
  edges: z.array(flowEdgeSchema).optional(),
  variables: z.array(flowVariableSchema).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const listFlowsQuerySchema = paginationSchema.extend({
  status: flowStatusSchema.optional(),
});

// ============================================
// Call Schemas
// ============================================

export const callStatusSchema = z.enum([
  "initiated",
  "ringing",
  "in_progress",
  "completed",
  "failed",
  "busy",
  "no_answer",
  "canceled",
]);

export const callDirectionSchema = z.enum(["inbound", "outbound"]);

export const phoneNumberSchema = z.string().regex(/^\+[1-9]\d{1,14}$/);

export const createCallSchema = z.object({
  flowId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  to: phoneNumberSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const listCallsQuerySchema = paginationSchema.extend({
  status: callStatusSchema.optional(),
  direction: callDirectionSchema.optional(),
  flowId: z.string().optional(),
  phoneNumberId: z.string().optional(),
  phoneNumber: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  orderBy: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export const internalCreateCallSchema = z.object({
  direction: callDirectionSchema,
  callerNumber: phoneNumberSchema,
  calleeNumber: phoneNumberSchema,
  flowId: z.string().optional(),
  phoneNumberId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ============================================
// Campaign Schemas
// ============================================

export const campaignStatusSchema = z.enum([
  "draft",
  "scheduled",
  "running",
  "paused",
  "completed",
]);

export const contactStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "failed",
  "dnc",
]);

export const timeSchema = z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/);

export const weekdaySchema = z.number().int().min(0).max(6);

// Common IANA timezones - validate timezone is parseable
const VALID_TIMEZONES = Intl.supportedValuesOf("timeZone");

export const timezoneSchema = z.string().refine(
  (tz) => VALID_TIMEZONES.includes(tz),
  { message: "Invalid timezone. Must be a valid IANA timezone (e.g., America/New_York)" }
);

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  flowId: z.string().min(1, "A published voice agent flow is required"),
  contactListId: z.string().optional(),
  scheduledStart: z.coerce.date().optional(),
  scheduledEnd: z.coerce.date().optional(),
  allowedHoursStart: timeSchema.optional(),
  allowedHoursEnd: timeSchema.optional(),
  allowedDays: z.array(weekdaySchema).min(1).max(7).optional(),
  timezone: timezoneSchema.optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
  retryIntervalHours: z.number().int().min(1).max(168).optional(),
  concurrentCalls: z.number().int().min(1).max(100).optional(),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export const listCampaignsQuerySchema = paginationSchema.extend({
  status: campaignStatusSchema.optional(),
  flowId: z.string().optional(),
  orderBy: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export const campaignContactSchema = z.object({
  phoneNumber: phoneNumberSchema,
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z.string().email().optional(),
  customData: z.record(z.string(), z.unknown()).optional(),
});

export const addContactsSchema = z.object({
  contacts: z.array(campaignContactSchema).min(1).max(10000),
});

export const listContactsQuerySchema = paginationSchema.extend({
  status: contactStatusSchema.optional(),
  search: z.string().optional(),
});

// ============================================
// Phone Number Schemas
// ============================================

export const createPhoneNumberSchema = z.object({
  phoneNumber: phoneNumberSchema,
  friendlyName: z.string().max(100).optional(),
  flowId: z.string().optional(),
});

export const updatePhoneNumberSchema = z.object({
  friendlyName: z.string().max(100).optional(),
  flowId: z.string().nullable().optional(),
});

export const purchasePhoneNumberSchema = z.object({
  number: phoneNumberSchema,
  friendlyName: z.string().max(100).optional(),
  mode: z.enum(["purchase", "manual"]).optional(),
});

export const searchPhoneNumbersQuerySchema = z.object({
  action: z.literal("search").optional(),
  country: z.string().length(2).optional(),
  areaCode: z.string().regex(/^\d{3}$/).optional(),
  contains: z.string().optional(),
});

// ============================================
// Auth Schemas
// ============================================

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
  name: z.string().min(1).max(100),
  organizationName: z.string().min(1).max(255).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ============================================
// Integration Schemas
// ============================================

export const integrationTypeSchema = z.enum([
  "openai",
  "elevenlabs",
  "deepgram",
  "twilio",
  "slack",
  "hubspot",
  "salesforce",
  "zapier",
]);

export const createIntegrationSchema = z.object({
  type: integrationTypeSchema,
  name: z.string().min(1).max(100),
  config: z.record(z.string(), z.unknown()),
  isActive: z.boolean().optional(),
});

export const updateIntegrationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// Validation Utilities
// ============================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: NextResponse };

/**
 * Validate request body against a Zod schema
 */
export function validateBody<T extends z.ZodSchema>(
  schema: T,
  body: unknown
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(body);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    return {
      success: false,
      error: NextResponse.json(
        {
          error: "Validation failed",
          details: errors,
        },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T extends z.ZodSchema>(
  schema: T,
  searchParams: URLSearchParams
): ValidationResult<z.infer<T>> {
  const params: Record<string, string | string[]> = {};

  searchParams.forEach((value, key) => {
    if (params[key]) {
      if (Array.isArray(params[key])) {
        (params[key] as string[]).push(value);
      } else {
        params[key] = [params[key] as string, value];
      }
    } else {
      params[key] = value;
    }
  });

  return validateBody(schema, params);
}

/**
 * Validate route parameters against a Zod schema
 */
export function validateParams<T extends z.ZodSchema>(
  schema: T,
  params: Record<string, string>
): ValidationResult<z.infer<T>> {
  return validateBody(schema, params);
}

/**
 * Parse and validate JSON body from request
 */
export async function parseAndValidateBody<T extends z.ZodSchema>(
  request: Request,
  schema: T
): Promise<ValidationResult<z.infer<T>>> {
  try {
    const body = await request.json();
    return validateBody(schema, body);
  } catch {
    return {
      success: false,
      error: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      ),
    };
  }
}

// ============================================
// Contact List Schemas
// ============================================

export const createContactListSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

export const updateContactListSchema = createContactListSchema.partial();

export const listContactListsQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
});

export const contactListItemSchema = z.object({
  phoneNumber: phoneNumberSchema,
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z.string().email().optional(),
  customData: z.record(z.string(), z.unknown()).optional(),
});

export const addContactListItemsSchema = z.object({
  contacts: z.array(contactListItemSchema).min(1).max(10000),
});
