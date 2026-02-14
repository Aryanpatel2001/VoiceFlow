/**
 * Request Security Utilities
 *
 * Security functions for request validation, body size limits,
 * secure ID generation, and error sanitization.
 *
 * @module lib/security/request-security
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// ============================================
// REQUEST BODY SIZE LIMITS
// ============================================

const DEFAULT_MAX_BODY_SIZE = 1024 * 1024; // 1MB
const WEBHOOK_MAX_BODY_SIZE = 512 * 1024; // 512KB for webhooks

interface BodySizeLimits {
  default: number;
  webhook: number;
  upload: number;
}

const BODY_SIZE_LIMITS: BodySizeLimits = {
  default: DEFAULT_MAX_BODY_SIZE,
  webhook: WEBHOOK_MAX_BODY_SIZE,
  upload: 10 * 1024 * 1024, // 10MB for uploads
};

export type BodySizeLimitType = keyof BodySizeLimits;

/**
 * Validate request body size before parsing
 * Returns error response if body is too large, null otherwise
 */
export function validateRequestBodySize(
  request: NextRequest,
  limitType: BodySizeLimitType = "default"
): NextResponse | null {
  const contentLength = request.headers.get("content-length");

  if (contentLength) {
    const size = parseInt(contentLength, 10);
    const maxSize = BODY_SIZE_LIMITS[limitType];

    if (size > maxSize) {
      return NextResponse.json(
        {
          error: "Request body too large",
          maxSize: maxSize,
          receivedSize: size,
        },
        { status: 413 }
      );
    }
  }

  return null;
}

/**
 * Safe JSON parse with size limit check
 * Parses request body only if within size limits
 */
export async function safeParseJSON<T = unknown>(
  request: NextRequest,
  limitType: BodySizeLimitType = "default"
): Promise<{ success: true; data: T } | { success: false; error: NextResponse }> {
  // Check content length header
  const sizeError = validateRequestBodySize(request, limitType);
  if (sizeError) {
    return { success: false, error: sizeError };
  }

  try {
    // Clone request to read body
    const body = await request.text();

    // Double-check actual size
    const maxSize = BODY_SIZE_LIMITS[limitType];
    if (body.length > maxSize) {
      return {
        success: false,
        error: NextResponse.json(
          { error: "Request body too large" },
          { status: 413 }
        ),
      };
    }

    const data = JSON.parse(body) as T;
    return { success: true, data };
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
// SECURE RANDOM GENERATION
// ============================================

/**
 * Generate a cryptographically secure session ID
 */
export function generateSecureSessionId(): string {
  return `session_${crypto.randomUUID()}`;
}

/**
 * Generate a cryptographically secure webhook ID
 */
export function generateSecureWebhookId(length: number = 24): string {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

/**
 * Generate a cryptographically secure API key
 */
export function generateSecureApiKey(): string {
  return `vfp_${crypto.randomBytes(32).toString("base64url")}`;
}

/**
 * Generate a cryptographically secure token
 */
export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

// ============================================
// WEBHOOK SECRET HASHING
// ============================================

/**
 * Hash a webhook secret for storage
 */
export function hashWebhookSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

/**
 * Verify a webhook secret against its hash
 */
export function verifyWebhookSecret(secret: string, hash: string): boolean {
  const computedHash = hashWebhookSecret(secret);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedHash),
      Buffer.from(hash)
    );
  } catch {
    return false;
  }
}

// ============================================
// TWILIO SIGNATURE VALIDATION
// ============================================

/**
 * Validate Twilio webhook signature
 * See: https://www.twilio.com/docs/usage/security#validating-requests
 */
export function validateTwilioSignature(
  signature: string | null,
  url: string,
  body: Record<string, string>
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.warn("[Security] TWILIO_AUTH_TOKEN not set, skipping signature validation");
    // In production, this should return false
    return process.env.NODE_ENV !== "production";
  }

  if (!signature) {
    console.error("[Security] Missing X-Twilio-Signature header");
    return false;
  }

  // Build the data string: URL + sorted params
  const sortedKeys = Object.keys(body).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + body[key];
  }

  // Compute expected signature
  const expectedSignature = crypto
    .createHmac("sha1", authToken)
    .update(data)
    .digest("base64");

  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// ============================================
// ERROR SANITIZATION
// ============================================

// Patterns that indicate sensitive information
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth/i,
  /credential/i,
  /private/i,
  /\/Users\//i,
  /\/home\//i,
  /node_modules/i,
  /at\s+\S+\s+\(/i, // Stack trace lines
  /Error:\s+ENOENT/i,
  /ECONNREFUSED/i,
  /SQL/i,
  /database/i,
  /postgres/i,
  /mysql/i,
  /connection refused/i,
  /ETIMEDOUT/i,
];

/**
 * Sanitize error message to prevent information leakage
 */
export function sanitizeErrorMessage(
  error: unknown,
  defaultMessage: string = "An error occurred"
): string {
  if (!(error instanceof Error)) {
    return defaultMessage;
  }

  const message = error.message;

  // Check for sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(message)) {
      return defaultMessage;
    }
  }

  // Truncate long messages
  if (message.length > 200) {
    return defaultMessage;
  }

  // Return safe message
  return message;
}

/**
 * Create a safe error response
 * Logs full error internally but returns sanitized message
 */
export function createSafeErrorResponse(
  error: unknown,
  defaultMessage: string,
  statusCode: number = 500,
  logPrefix: string = "API"
): NextResponse {
  // Log full error internally
  console.error(`[${logPrefix}] Error:`, error);

  // Return sanitized response
  return NextResponse.json(
    { error: sanitizeErrorMessage(error, defaultMessage) },
    { status: statusCode }
  );
}

// ============================================
// INPUT SANITIZATION
// ============================================

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Redact sensitive fields from an object for logging
 */
export function redactSensitiveFields<T extends Record<string, unknown>>(
  obj: T,
  sensitiveKeys: string[] = [
    "password",
    "secret",
    "token",
    "apiKey",
    "authorization",
    "cookie",
    "x-webhook-secret",
    "x-internal-caller",
  ]
): T {
  const redacted: Record<string, unknown> = { ...obj };

  for (const key of Object.keys(redacted)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk.toLowerCase()))) {
      redacted[key] = "[REDACTED]";
    } else if (typeof redacted[key] === "object" && redacted[key] !== null) {
      redacted[key] = redactSensitiveFields(
        redacted[key] as Record<string, unknown>,
        sensitiveKeys
      );
    }
  }

  return redacted as T;
}

// ============================================
// REQUEST ID TRACING
// ============================================

/**
 * Get or generate a request ID for tracing
 */
export function getRequestId(request: NextRequest): string {
  const existingId = request.headers.get("x-request-id");
  if (existingId) {
    return existingId;
  }
  return crypto.randomUUID();
}

/**
 * Add request ID to response headers
 */
export function addRequestIdHeader(
  response: NextResponse,
  requestId: string
): NextResponse {
  response.headers.set("x-request-id", requestId);
  return response;
}

/**
 * Wrap a handler with request ID tracing
 * Adds x-request-id header to all responses
 */
export function withRequestTracing<T extends NextResponse>(
  request: NextRequest,
  handler: (requestId: string) => Promise<T> | T
): Promise<T> {
  const requestId = getRequestId(request);
  return Promise.resolve(handler(requestId)).then((response) => {
    response.headers.set("x-request-id", requestId);
    return response;
  });
}

/**
 * Log helper that includes request ID
 */
export function createRequestLogger(requestId: string, prefix: string = "API") {
  return {
    info: (...args: unknown[]) => console.log(`[${prefix}] [${requestId}]`, ...args),
    warn: (...args: unknown[]) => console.warn(`[${prefix}] [${requestId}]`, ...args),
    error: (...args: unknown[]) => console.error(`[${prefix}] [${requestId}]`, ...args),
  };
}

// ============================================
// FETCH WITH TIMEOUT
// ============================================

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Fetch with timeout support
 * Automatically aborts the request if it exceeds the timeout
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================
// OAUTH STATE SECURITY
// ============================================

const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || process.env.NEXTAUTH_SECRET || "fallback-dev-secret";

/**
 * Generate an encrypted OAuth state
 */
export function generateOAuthState(data: Record<string, string>): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(OAUTH_STATE_SECRET, "salt", 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const payload = JSON.stringify({
    ...data,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(8).toString("hex"),
  });

  let encrypted = cipher.update(payload, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  // Combine iv + authTag + encrypted data
  return Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, "base64"),
  ]).toString("base64url");
}

/**
 * Decrypt and validate OAuth state
 */
export function verifyOAuthState(
  state: string,
  maxAgeMs: number = 10 * 60 * 1000 // 10 minutes
): { valid: true; data: Record<string, string> } | { valid: false; error: string } {
  try {
    const buffer = Buffer.from(state, "base64url");

    // Extract components
    const iv = buffer.subarray(0, 16);
    const authTag = buffer.subarray(16, 32);
    const encrypted = buffer.subarray(32);

    const key = crypto.scryptSync(OAUTH_STATE_SECRET, "salt", 32);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    const payload = JSON.parse(decrypted.toString("utf8"));

    // Check timestamp
    if (Date.now() - payload.timestamp > maxAgeMs) {
      return { valid: false, error: "State expired" };
    }

    // Remove internal fields
    const { timestamp, nonce, ...data } = payload;
    return { valid: true, data };
  } catch {
    return { valid: false, error: "Invalid state" };
  }
}
