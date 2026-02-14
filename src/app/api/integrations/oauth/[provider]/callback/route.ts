/**
 * OAuth Callback Route
 *
 * Handles OAuth redirect from the provider.
 * Exchanges code for tokens, encrypts and stores them.
 */

import { NextRequest, NextResponse } from "next/server";
import { getProvider, isValidProvider } from "@/lib/integrations";
import { decryptJSON } from "@/lib/encryption";
import { upsertIntegration, updateIntegrationStatus } from "@/services/integration.service";
import type { ProviderSlug } from "@/lib/integrations/types";
import { checkRateLimit, cleanupRateLimitBuckets } from "@/lib/rate-limit";
import { getRequestMetadata, rateLimitResponse } from "@/lib/request-meta";
import { createAuditLog } from "@/services/audit.service";

interface OAuthState {
  organizationId: string;
  provider: string;
  nonce: string;
  timestamp: number;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(
    /\/$/,
    ""
  );
  const cookieName = `integration_oauth_nonce_${params.provider}`;
  const redirectWithCleanup = (url: string) => {
    const response = NextResponse.redirect(url);
    response.cookies.delete(cookieName);
    return response;
  };

  try {
    const { provider } = params;
    cleanupRateLimitBuckets();
    const { ipAddress, userAgent } = getRequestMetadata(req);
    const rlKey = `integrations:oauth:callback:${provider}:${ipAddress || "unknown"}`;
    const rl = checkRateLimit(rlKey, 30, 60_000);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterSeconds);
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle user denial
    if (error) {
      console.log(`[OAuth] User denied access for ${provider}: ${error}`);
      return redirectWithCleanup(
        `${baseUrl}/dashboard/integrations?error=denied&provider=${provider}`
      );
    }

    if (!code || !state) {
      return redirectWithCleanup(
        `${baseUrl}/dashboard/integrations?error=missing_params&provider=${provider}`
      );
    }

    if (!isValidProvider(provider)) {
      return redirectWithCleanup(
        `${baseUrl}/dashboard/integrations?error=invalid_provider`
      );
    }

    // Decrypt and validate state
    let oauthState: OAuthState;
    try {
      oauthState = decryptJSON<OAuthState>(state);
    } catch {
      return redirectWithCleanup(
        `${baseUrl}/dashboard/integrations?error=invalid_state&provider=${provider}`
      );
    }

    // Verify provider matches
    if (oauthState.provider !== provider) {
      return redirectWithCleanup(
        `${baseUrl}/dashboard/integrations?error=state_mismatch&provider=${provider}`
      );
    }

    const cookieNonce = req.cookies.get(cookieName)?.value;
    if (!cookieNonce || oauthState.nonce !== cookieNonce) {
      return redirectWithCleanup(
        `${baseUrl}/dashboard/integrations?error=nonce_mismatch&provider=${provider}`
      );
    }

    // Anti-replay: state must be less than 10 minutes old
    const tenMinutes = 10 * 60 * 1000;
    if (Date.now() - oauthState.timestamp > tenMinutes) {
      return redirectWithCleanup(
        `${baseUrl}/dashboard/integrations?error=state_expired&provider=${provider}`
      );
    }

    const providerInstance = getProvider(provider);
    const redirectUri = `${baseUrl}/api/integrations/oauth/${provider}/callback`;

    // Exchange code for tokens
    const credentials = await providerInstance.handleCallback(code, redirectUri);

    // Store encrypted credentials
    await upsertIntegration(
      oauthState.organizationId,
      provider as ProviderSlug,
      credentials
    );
    await createAuditLog({
      organizationId: oauthState.organizationId,
      action: "integration.connect",
      entityType: "integration",
      newValues: { provider, status: "connected", source: "oauth" },
      ipAddress,
      userAgent,
    });

    // Test the connection
    try {
      const connected = await providerInstance.testConnection(credentials);
      if (!connected) {
        await updateIntegrationStatus(
          oauthState.organizationId,
          provider,
          "error",
          "Connection test failed after OAuth"
        );
      }
    } catch (testError) {
      console.warn(`[OAuth] Connection test failed for ${provider}:`, testError);
    }

    console.log(`[OAuth] Successfully connected ${provider} for org ${oauthState.organizationId}`);

    return redirectWithCleanup(
      `${baseUrl}/dashboard/integrations?connected=${provider}`
    );
  } catch (error) {
    console.error("[OAuth] Callback error:", error);
    return redirectWithCleanup(
      `${baseUrl}/dashboard/integrations?error=callback_failed&provider=${params.provider}`
    );
  }
}
