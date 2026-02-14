/**
 * Rate Limiting Utility
 *
 * In-memory rate limiting with configurable limits per endpoint type.
 * Uses sliding window algorithm for accurate rate limiting.
 *
 * @module lib/rate-limit
 */

import { NextRequest, NextResponse } from "next/server";

// ============================================
// Types
// ============================================

type Bucket = {
  count: number;
  resetAt: number;
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterSeconds: number;
}

export interface RateLimitConfig {
  max: number;      // Maximum requests
  windowMs: number; // Time window in milliseconds
}

// ============================================
// Rate Limit Configurations
// ============================================

/**
 * Pre-defined rate limit configurations for different endpoint types
 */
export const RATE_LIMITS = {
  // Auth endpoints - strict limits to prevent brute force
  auth: {
    max: 5,
    windowMs: 60 * 1000, // 5 requests per minute
  },

  // Signup - very strict
  signup: {
    max: 3,
    windowMs: 60 * 1000, // 3 signups per minute
  },

  // Read operations - more lenient
  read: {
    max: 100,
    windowMs: 60 * 1000, // 100 requests per minute
  },

  // Write operations - moderate limits
  write: {
    max: 30,
    windowMs: 60 * 1000, // 30 requests per minute
  },

  // Voice/call operations - moderate limits
  voice: {
    max: 20,
    windowMs: 60 * 1000, // 20 requests per minute
  },

  // Webhook endpoints - high limits for external services
  webhook: {
    max: 500,
    windowMs: 60 * 1000, // 500 requests per minute
  },

  // AI/LLM operations - lower limits due to cost
  ai: {
    max: 30,
    windowMs: 60 * 1000, // 30 requests per minute
  },

  // Integration actions - moderate
  integration: {
    max: 50,
    windowMs: 60 * 1000, // 50 requests per minute
  },

  // Default fallback
  default: {
    max: 60,
    windowMs: 60 * 1000, // 60 requests per minute
  },
} as const;

export type RateLimitType = keyof typeof RATE_LIMITS;

// ============================================
// In-Memory Storage
// ============================================

const buckets = new Map<string, Bucket>();

// Periodic cleanup to prevent memory leaks
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanupInterval(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    cleanupRateLimitBuckets();
  }, 60 * 1000); // Cleanup every minute
}

// Start cleanup on module load
if (typeof window === "undefined") {
  startCleanupInterval();
}

// ============================================
// Core Functions
// ============================================

/**
 * Check if a request is within rate limits
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: max - 1,
      limit: max,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (current.count >= max) {
    return {
      allowed: false,
      remaining: 0,
      limit: max,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  buckets.set(key, current);
  return {
    allowed: true,
    remaining: max - current.count,
    limit: max,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

/**
 * Check rate limit using a predefined configuration
 */
export function checkRateLimitByType(
  key: string,
  type: RateLimitType
): RateLimitResult {
  const config = RATE_LIMITS[type];
  return checkRateLimit(key, config.max, config.windowMs);
}

/**
 * Cleanup expired buckets to prevent memory leaks
 */
export function cleanupRateLimitBuckets(maxEntries: number = 10000): void {
  const now = Date.now();

  // First, remove expired entries
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  });

  // If still too many, remove oldest
  if (buckets.size > maxEntries) {
    const entries = Array.from(buckets.entries());
    entries.sort((a, b) => a[1].resetAt - b[1].resetAt);
    const toRemove = entries.slice(0, buckets.size - maxEntries);
    toRemove.forEach(([key]) => buckets.delete(key));
  }
}

// ============================================
// Request Helpers
// ============================================

/**
 * Extract client identifier from request
 * Uses IP address, falling back to user ID if authenticated
 */
export function getClientIdentifier(req: NextRequest, userId?: string): string {
  // Try to get real IP from various headers
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfConnectingIp = req.headers.get("cf-connecting-ip");

  const ip = cfConnectingIp || realIp || forwardedFor?.split(",")[0]?.trim() || "unknown";

  // Combine IP with user ID for authenticated requests
  if (userId) {
    return `${userId}:${ip}`;
  }

  return ip;
}

/**
 * Create a rate limit key for an endpoint
 */
export function createRateLimitKey(
  identifier: string,
  endpoint: string
): string {
  return `rl:${endpoint}:${identifier}`;
}

// ============================================
// Response Helpers
// ============================================

/**
 * Create rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.retryAfterSeconds.toString(),
  };
}

/**
 * Create a rate limited response (429 Too Many Requests)
 */
export function rateLimitedResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests",
      message: `Rate limit exceeded. Please try again in ${result.retryAfterSeconds} seconds.`,
      retryAfter: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        ...getRateLimitHeaders(result),
        "Retry-After": result.retryAfterSeconds.toString(),
      },
    }
  );
}

// ============================================
// Middleware Helper
// ============================================

/**
 * Rate limit wrapper for API route handlers
 *
 * @example
 * ```ts
 * export const GET = withRateLimit(
 *   async (req) => {
 *     // Your handler logic
 *     return NextResponse.json({ data: "..." });
 *   },
 *   "read",
 *   "flows"
 * );
 * ```
 */
export function withRateLimit<T extends NextRequest>(
  handler: (req: T, context?: unknown) => Promise<NextResponse>,
  type: RateLimitType = "default",
  endpoint: string = "api"
) {
  return async (req: T, context?: unknown): Promise<NextResponse> => {
    const identifier = getClientIdentifier(req);
    const key = createRateLimitKey(identifier, endpoint);
    const result = checkRateLimitByType(key, type);

    if (!result.allowed) {
      return rateLimitedResponse(result);
    }

    // Call the actual handler
    const response = await handler(req, context);

    // Add rate limit headers to successful responses
    const headers = new Headers(response.headers);
    Object.entries(getRateLimitHeaders(result)).forEach(([name, value]) => {
      headers.set(name, value);
    });

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

/**
 * Simple rate limit check for use inside handlers
 *
 * @example
 * ```ts
 * export async function POST(req: NextRequest) {
 *   const rateLimitResult = applyRateLimit(req, "write", "flows");
 *   if (rateLimitResult) return rateLimitResult;
 *
 *   // Continue with handler logic...
 * }
 * ```
 */
export function applyRateLimit(
  req: NextRequest,
  type: RateLimitType = "default",
  endpoint: string = "api",
  userId?: string
): NextResponse | null {
  const identifier = getClientIdentifier(req, userId);
  const key = createRateLimitKey(identifier, endpoint);
  const result = checkRateLimitByType(key, type);

  if (!result.allowed) {
    return rateLimitedResponse(result);
  }

  return null; // Allowed
}

// ============================================
// Stats (for monitoring)
// ============================================

/**
 * Get current rate limit stats
 */
export function getRateLimitStats(): {
  totalBuckets: number;
  activeBuckets: number;
} {
  const now = Date.now();
  let activeBuckets = 0;

  buckets.forEach((bucket) => {
    if (bucket.resetAt > now) {
      activeBuckets++;
    }
  });

  return {
    totalBuckets: buckets.size,
    activeBuckets,
  };
}
