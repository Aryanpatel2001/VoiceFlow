/**
 * OAuth Authorize Route
 *
 * Initiates OAuth flow for an integration provider.
 * Redirects user to the provider's consent page.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "crypto";
import { authOptions } from "@/lib/auth/config";
import { getProvider, isValidProvider } from "@/lib/integrations";
import { encryptJSON } from "@/lib/encryption";
import { checkRateLimit, cleanupRateLimitBuckets } from "@/lib/rate-limit";
import { rateLimitResponse } from "@/lib/request-meta";

export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    cleanupRateLimitBuckets();
    const rl = checkRateLimit(
      `integrations:oauth:authorize:${session.user.organizationId}:${params.provider}`,
      20,
      60_000
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterSeconds);
    }

    const { provider } = params;

    if (!isValidProvider(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const providerInstance = getProvider(provider);
    const cookieName = `integration_oauth_nonce_${provider}`;

    // Build redirect URI
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(
      /\/$/,
      ""
    );
    const redirectUri = `${baseUrl}/api/integrations/oauth/${provider}/callback`;
    const nonce = crypto.randomBytes(16).toString("hex");

    // Generate encrypted state for CSRF protection
    const state = encryptJSON({
      organizationId: session.user.organizationId,
      provider,
      nonce,
      timestamp: Date.now(),
    });

    // Get OAuth URL from provider
    const authUrl = providerInstance.getAuthUrl(
      session.user.organizationId,
      redirectUri,
      state
    );

    const response = NextResponse.redirect(authUrl);
    response.cookies.set(cookieName, nonce, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    console.error("[OAuth] Authorize error:", error);
    return NextResponse.json(
      { error: "Failed to initiate OAuth" },
      { status: 500 }
    );
  }
}
