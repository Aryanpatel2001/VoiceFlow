/**
 * Integrations API
 *
 * GET: List all integrations for the organization + available providers
 * POST: Connect a non-OAuth integration (custom webhook)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { getAllProviders } from "@/lib/integrations";
import { assertSafeWebhookUrl } from "@/lib/integrations/webhook-security";
import { checkRateLimit, cleanupRateLimitBuckets } from "@/lib/rate-limit";
import { getRequestMetadata, rateLimitResponse } from "@/lib/request-meta";
import {
  getIntegrationsByOrganization,
  upsertIntegration,
} from "@/services/integration.service";
import { createAuditLog } from "@/services/audit.service";
import type { ProviderSlug, WebhookCredentials } from "@/lib/integrations/types";

// GET: List integrations + available providers
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    cleanupRateLimitBuckets();
    const rl = checkRateLimit(
      `integrations:list:${session.user.organizationId}`,
      120,
      60_000
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterSeconds);
    }

    const integrations = await getIntegrationsByOrganization(session.user.organizationId);
    const availableProviders = getAllProviders();

    // Merge: mark each provider with its connection status
    const providers = availableProviders.map((provider) => {
      const integration = integrations.find((i) => i.provider === provider.slug);
      return {
        ...provider,
        status: integration?.status || "disconnected",
        lastSyncAt: integration?.last_sync_at?.toISOString() || null,
        errorMessage: integration?.error_message || null,
      };
    });

    return NextResponse.json({ providers });
  } catch (error) {
    console.error("[Integrations] List error:", error);
    return NextResponse.json(
      { error: "Failed to list integrations" },
      { status: 500 }
    );
  }
}

// POST: Connect a non-OAuth integration (webhook)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    cleanupRateLimitBuckets();
    const rl = checkRateLimit(
      `integrations:connect:${session.user.organizationId}`,
      20,
      60_000
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterSeconds);
    }

    const body = await req.json();
    const { provider, webhook_url, secret, headers } = body;

    if (provider !== "custom_webhook") {
      return NextResponse.json(
        { error: "Use OAuth flow for this provider. POST is for webhook only." },
        { status: 400 }
      );
    }

    if (!webhook_url) {
      return NextResponse.json(
        { error: "webhook_url is required" },
        { status: 400 }
      );
    }

    let safeWebhookUrl: URL;
    try {
      safeWebhookUrl = await assertSafeWebhookUrl(String(webhook_url));
    } catch (validationError) {
      const message =
        validationError instanceof Error
          ? validationError.message
          : "Invalid webhook URL";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const credentials: WebhookCredentials = {
      webhook_url: safeWebhookUrl.toString(),
      secret: secret || undefined,
      headers: headers || undefined,
    };

    const integration = await upsertIntegration(
      session.user.organizationId,
      provider as ProviderSlug,
      credentials
    );

    const { ipAddress, userAgent } = getRequestMetadata(req);
    await createAuditLog({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "integration.connect",
      entityType: "integration",
      newValues: {
        provider,
        status: integration.status,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ integration: { provider: integration.provider, status: integration.status } }, { status: 201 });
  } catch (error) {
    console.error("[Integrations] Connect error:", error);
    return NextResponse.json(
      { error: "Failed to connect integration" },
      { status: 500 }
    );
  }
}
