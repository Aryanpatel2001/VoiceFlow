import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import { getFlowById, validateFlowData } from "@/services/flow.service";
import { validateSinglePromptConfig } from "@/lib/prompt-agent";
import { getIntegration } from "@/services/integration.service";
import {
  validateWebhookUrls,
  testWebhookReachability,
} from "@/lib/voice/webhook-validation";
import type { PromptAgentTool } from "@/lib/prompt-agent/types";

// ============================================
// System Configuration Status (GET)
// ============================================

export interface SystemPreflightStatus {
  ready: boolean;
  twilio: {
    configured: boolean;
    error?: string;
  };
  webhooks: {
    valid: boolean;
    voiceUrl: string;
    statusUrl: string;
    errors: string[];
    warnings: string[];
    reachable?: boolean;
  };
  timestamp: string;
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = applyRateLimit(request, "read", "voice/preflight");
    if (rateLimitResult) return rateLimitResult;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const testReachability = url.searchParams.get("testReachability") === "true";

    // Check Twilio credentials
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
    const twilioConfigured = Boolean(twilioSid && twilioAuth);

    // Validate webhook URLs
    const webhookValidation = validateWebhookUrls();

    // Optionally test reachability (only for non-localhost)
    let reachable: boolean | undefined;
    if (
      testReachability &&
      webhookValidation.valid &&
      !webhookValidation.voiceUrl.includes("localhost")
    ) {
      const reachabilityResult = await testWebhookReachability(
        webhookValidation.voiceUrl,
        5000
      );
      reachable = reachabilityResult.reachable;
      if (!reachable && reachabilityResult.error) {
        webhookValidation.warnings.push(
          `Webhook may not be reachable: ${reachabilityResult.error}`
        );
      }
    }

    const status: SystemPreflightStatus = {
      ready: twilioConfigured && webhookValidation.valid,
      twilio: {
        configured: twilioConfigured,
        error: twilioConfigured
          ? undefined
          : "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set",
      },
      webhooks: {
        valid: webhookValidation.valid,
        voiceUrl: webhookValidation.voiceUrl,
        statusUrl: webhookValidation.statusUrl,
        errors: webhookValidation.errors,
        warnings: webhookValidation.warnings,
        reachable,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error("System preflight check error:", error);
    return NextResponse.json(
      { error: "Failed to perform preflight check" },
      { status: 500 }
    );
  }
}

// ============================================
// Flow-specific Preflight Check (POST)
// ============================================

type CheckLevel = "error" | "warning";

interface PreflightCheck {
  code: string;
  level: CheckLevel;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - read operations
    const rateLimitResponse = applyRateLimit(request, "read", "voice/preflight");
    if (rateLimitResponse) return rateLimitResponse;

    const user = await getAuthenticatedUser();
    if (!user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const flowId = String(body.flowId || "");
    if (!flowId) {
      return NextResponse.json({ error: "flowId is required" }, { status: 400 });
    }

    const flow = await getFlowById(flowId, user.organizationId);
    if (!flow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    const checks: PreflightCheck[] = [];

    if (flow.status !== "published") {
      checks.push({
        code: "FLOW_NOT_PUBLISHED",
        level: "warning",
        message: "Flow is draft. Publish before production testing.",
      });
    }

    if (flow.agentMode === "single_prompt") {
      const validation = validateSinglePromptConfig(flow.flowData.settings.promptConfig);
      checks.push(
        ...validation.errors.map((message) => ({
          code: "INVALID_PROMPT_CONFIG",
          level: "error" as const,
          message,
        }))
      );

      const tools = flow.flowData.settings.promptConfig?.tools || [];
      const requiredProviders = getRequiredProviders(tools);
      for (const provider of requiredProviders) {
        const integration = await getIntegration(user.organizationId, provider);
        if (!integration || integration.status !== "connected" || !integration.credentials) {
          checks.push({
            code: "MISSING_INTEGRATION",
            level: "error",
            message: `Required integration "${provider}" is not connected.`,
          });
        }
      }
    } else {
      const validation = validateFlowData(flow.flowData);
      checks.push(
        ...validation.errors.map((error) => ({
          code: error.code || "INVALID_FLOW",
          level: "error" as const,
          message: error.message,
        })),
        ...validation.warnings.map((warning) => ({
          code: warning.code || "FLOW_WARNING",
          level: "warning" as const,
          message: warning.message,
        }))
      );
    }

    return NextResponse.json({
      ok: !checks.some((c) => c.level === "error"),
      checks,
      meta: {
        flowId: flow.id,
        flowName: flow.name,
        agentMode: flow.agentMode || "canvas",
        status: flow.status,
      },
    });
  } catch (error) {
    console.error("[Voice Preflight] Error:", error);
    return NextResponse.json({ error: "Failed to run preflight" }, { status: 500 });
  }
}

function getRequiredProviders(tools: PromptAgentTool[]): string[] {
  const providers = new Set<string>();
  for (const tool of tools) {
    if (tool.type === "integration") {
      providers.add(tool.provider);
    }
    if (tool.type === "check_availability" || tool.type === "book_slot") {
      providers.add("google_calendar");
    }
  }
  return Array.from(providers);
}
