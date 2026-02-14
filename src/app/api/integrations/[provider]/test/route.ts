/**
 * Integration Test Connection API
 *
 * POST: Test if the integration is still connected and working
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { getProvider, isValidProvider } from "@/lib/integrations";
import { checkRateLimit, cleanupRateLimitBuckets } from "@/lib/rate-limit";
import { getRequestMetadata, rateLimitResponse } from "@/lib/request-meta";
import {
  getIntegration,
  getDecryptedCredentials,
  updateIntegrationStatus,
} from "@/services/integration.service";
import { createAuditLog } from "@/services/audit.service";

export async function POST(
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
      `integrations:test:${session.user.organizationId}:${params.provider}`,
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

    const integration = await getIntegration(session.user.organizationId, provider);
    if (!integration || !integration.credentials) {
      return NextResponse.json(
        { error: "Integration not connected" },
        { status: 404 }
      );
    }

    const providerInstance = getProvider(provider);
    const credentials = await getDecryptedCredentials(integration);
    const connected = await providerInstance.testConnection(credentials);

    if (connected) {
      await updateIntegrationStatus(session.user.organizationId, provider, "connected");
      const { ipAddress, userAgent } = getRequestMetadata(req);
      await createAuditLog({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "integration.test",
        entityType: "integration",
        newValues: { provider, result: "connected" },
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ connected: true });
    } else {
      await updateIntegrationStatus(
        session.user.organizationId,
        provider,
        "error",
        "Connection test failed"
      );
      const { ipAddress, userAgent } = getRequestMetadata(req);
      await createAuditLog({
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: "integration.test",
        entityType: "integration",
        newValues: { provider, result: "error" },
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ connected: false, error: "Connection test failed" });
    }
  } catch (error) {
    console.error("[Integrations] Test error:", error);
    return NextResponse.json(
      { error: "Failed to test connection" },
      { status: 500 }
    );
  }
}
