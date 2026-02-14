/**
 * Single Integration API
 *
 * GET: Get integration details
 * DELETE: Disconnect integration
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { getProvider, isValidProvider } from "@/lib/integrations";
import { checkRateLimit, cleanupRateLimitBuckets } from "@/lib/rate-limit";
import { getRequestMetadata, rateLimitResponse } from "@/lib/request-meta";
import {
  getIntegration,
  deleteIntegration,
  getDecryptedCredentials,
} from "@/services/integration.service";
import { createAuditLog } from "@/services/audit.service";

// GET: Get integration details
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
      `integrations:get:${session.user.organizationId}:${params.provider}`,
      120,
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
    const integration = await getIntegration(session.user.organizationId, provider);

    return NextResponse.json({
      provider: providerInstance.slug,
      name: providerInstance.name,
      description: providerInstance.description,
      icon: providerInstance.icon,
      color: providerInstance.color,
      category: providerInstance.category,
      status: integration?.status || "disconnected",
      settings: integration?.settings || {},
      lastSyncAt: integration?.last_sync_at?.toISOString() || null,
      errorMessage: integration?.error_message || null,
      actions: providerInstance.getActions(),
    });
  } catch (error) {
    console.error("[Integrations] Get error:", error);
    return NextResponse.json(
      { error: "Failed to get integration" },
      { status: 500 }
    );
  }
}

// DELETE: Disconnect integration
export async function DELETE(
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
      `integrations:delete:${session.user.organizationId}:${params.provider}`,
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

    // Try to revoke token if supported
    const integration = await getIntegration(session.user.organizationId, provider);
    if (integration && integration.credentials) {
      try {
        const providerInstance = getProvider(provider);
        if (providerInstance.revokeToken) {
          const creds = await getDecryptedCredentials(integration);
          await providerInstance.revokeToken(creds);
        }
      } catch (revokeError) {
        console.warn(`[Integrations] Token revocation failed for ${provider}:`, revokeError);
      }
    }

    const deleted = await deleteIntegration(session.user.organizationId, provider);
    if (!deleted) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    const { ipAddress, userAgent } = getRequestMetadata(req);
    await createAuditLog({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "integration.disconnect",
      entityType: "integration",
      oldValues: {
        provider,
        previousStatus: integration?.status || "unknown",
      },
      newValues: {
        provider,
        status: "disconnected",
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Integrations] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect integration" },
      { status: 500 }
    );
  }
}
