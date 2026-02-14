/**
 * Next.js Middleware
 *
 * Handles CORS for API routes and adds security headers.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.NEXTAUTH_URL,
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean) as string[];

// API routes that need CORS
const API_ROUTES = ["/api/"];

// Public routes that don't need auth
const PUBLIC_API_ROUTES = [
  "/api/health",
  "/api/webhook/",
  "/api/voice/twilio",
  "/api/auth/",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin") || "";

  // Handle preflight requests
  if (request.method === "OPTIONS") {
    return handlePreflight(request, origin);
  }

  // Add CORS and security headers to API responses
  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    return addCorsHeaders(response, origin);
  }

  return NextResponse.next();
}

/**
 * Handle CORS preflight (OPTIONS) requests
 */
function handlePreflight(request: NextRequest, origin: string): NextResponse {
  const response = new NextResponse(null, { status: 204 });

  // Check if origin is allowed
  if (isAllowedOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }

  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Request-Id, X-Internal-API-Key, X-Webhook-Secret"
  );
  response.headers.set("Access-Control-Max-Age", "86400"); // 24 hours
  response.headers.set("Access-Control-Allow-Credentials", "true");

  return response;
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: NextResponse, origin: string): NextResponse {
  // Add CORS headers if origin is allowed
  if (isAllowedOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  // Add security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

/**
 * Check if origin is in the allowed list
 */
function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;

  // Allow exact matches
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // Allow subdomains of vercel.app for preview deployments
  if (origin.endsWith(".vercel.app")) {
    return true;
  }

  return false;
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    // Match all API routes
    "/api/:path*",
  ],
};
