/**
 * Integration Settings API
 *
 * PATCH: Update settings for a connected integration
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth/config";
import { isValidProvider } from "@/lib/integrations";
import type { ProviderSlug } from "@/lib/integrations/types";
import { checkRateLimit, cleanupRateLimitBuckets } from "@/lib/rate-limit";
import { getRequestMetadata, rateLimitResponse } from "@/lib/request-meta";
import {
  getIntegration,
  updateIntegrationSettings,
} from "@/services/integration.service";
import { createAuditLog } from "@/services/audit.service";

const settingsSchemas: Record<ProviderSlug, z.ZodObject<Record<string, z.ZodTypeAny>>> = {
  google_calendar: z
    .object({
      default_calendar_id: z.string().trim().min(1).optional(),
      default_duration: z.coerce.number().int().min(1).max(1440).optional(),
      timezone: z.string().trim().min(1).optional(),
    })
    .strict(),
  hubspot: z
    .object({
      default_pipeline: z.string().trim().min(1).optional(),
      default_deal_stage: z.string().trim().min(1).optional(),
    })
    .strict(),
  salesforce: z
    .object({
      default_lead_status: z.string().trim().min(1).optional(),
      default_opp_stage: z.string().trim().min(1).optional(),
    })
    .strict(),
  custom_webhook: z
    .object({
      timeout_ms: z.coerce.number().int().min(100).max(120000).optional(),
    })
    .strict(),
};

export async function PATCH(
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
      `integrations:settings:${session.user.organizationId}:${params.provider}`,
      30,
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
    if (!integration) {
      return NextResponse.json(
        { error: "Integration not connected" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { settings } = body;

    if (!settings || typeof settings !== "object") {
      return NextResponse.json(
        { error: "settings object is required" },
        { status: 400 }
      );
    }

    const parsed = settingsSchemas[provider].safeParse(settings);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid settings payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Merge with existing settings
    const mergedSettings = { ...(integration.settings || {}), ...parsed.data };

    await updateIntegrationSettings(
      session.user.organizationId,
      provider,
      mergedSettings
    );

    const { ipAddress, userAgent } = getRequestMetadata(req);
    await createAuditLog({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "integration.settings.update",
      entityType: "integration",
      oldValues: integration.settings || {},
      newValues: mergedSettings,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      settings: mergedSettings,
    });
  } catch (error) {
    console.error("[Integrations] Settings error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
