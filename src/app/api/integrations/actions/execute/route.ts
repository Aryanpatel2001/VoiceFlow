/**
 * Integration Action Execute API
 *
 * POST: Execute an integration action (for canvas test mode)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { getProvider, isValidProvider } from "@/lib/integrations";
import { checkRateLimit, cleanupRateLimitBuckets } from "@/lib/rate-limit";
import { rateLimitResponse } from "@/lib/request-meta";
import {
  getIntegration,
  getDecryptedCredentials,
} from "@/services/integration.service";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    cleanupRateLimitBuckets();
    const rl = checkRateLimit(
      `integrations:execute:${session.user.organizationId}`,
      60,
      60_000
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterSeconds);
    }

    const body = await req.json();
    const { provider: providerSlug, actionId, inputs } = body;

    if (!providerSlug || !actionId) {
      return NextResponse.json(
        { error: "provider and actionId are required" },
        { status: 400 }
      );
    }

    if (!isValidProvider(providerSlug)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const integration = await getIntegration(
      session.user.organizationId,
      providerSlug
    );
    if (!integration || !integration.credentials) {
      return NextResponse.json(
        { error: "Integration not connected" },
        { status: 404 }
      );
    }

    const providerInstance = getProvider(providerSlug);

    // Validate actionId exists
    const actions = providerInstance.getActions();
    const action = actions.find((a) => a.id === actionId);
    if (!action) {
      return NextResponse.json(
        { error: `Action "${actionId}" not found for provider "${providerSlug}"` },
        { status: 400 }
      );
    }

    // Validate required inputs
    const missingInputs = action.inputSchema
      .filter((field) => {
        if (!field.required) return false;
        const value = inputs?.[field.name];
        if (value === undefined || value === null) return true;

        if (
          (field.type === "string" ||
            field.type === "email" ||
            field.type === "phone" ||
            field.type === "date") &&
          typeof value === "string" &&
          value.trim() === ""
        ) {
          return true;
        }

        return false;
      })
      .map((field) => field.name);

    if (missingInputs.length > 0) {
      return NextResponse.json(
        { error: `Missing required inputs: ${missingInputs.join(", ")}` },
        { status: 400 }
      );
    }

    const credentials = await getDecryptedCredentials(integration);
    const result = await providerInstance.executeAction(
      actionId,
      inputs || {},
      credentials,
      integration.settings || {}
    );

    return NextResponse.json({ result });
  } catch (error) {
    console.error("[Integrations] Execute error:", error);
    return NextResponse.json(
      { error: "Failed to execute action" },
      { status: 500 }
    );
  }
}
