/**
 * Campaigns API Route
 *
 * GET /api/campaigns - List campaigns for organization
 * POST /api/campaigns - Create a new campaign
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import { getRequestMetadata } from "@/lib/request-meta";
import {
  createCampaign,
  getCampaignsByOrganization,
} from "@/services/campaign.service";
import { getFlowById } from "@/services/flow.service";
import { createAuditLog } from "@/services/audit.service";
import {
  validateQuery,
  parseAndValidateBody,
  listCampaignsQuerySchema,
  createCampaignSchema,
} from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    // Rate limiting - read operations
    const rateLimitResponse = applyRateLimit(request, "read", "campaigns");
    if (rateLimitResponse) return rateLimitResponse;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.organizationId) {
      return NextResponse.json(
        { error: "Organization required" },
        { status: 400 }
      );
    }

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const validation = validateQuery(listCampaignsQuerySchema, searchParams);
    if (!validation.success) {
      return validation.error;
    }

    const { status, flowId, limit, offset, orderBy, order } = validation.data;

    const result = await getCampaignsByOrganization(
      user.organizationId,
      {
        status,
        flowId,
      },
      {
        limit,
        offset,
        orderBy,
        order,
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("List campaigns error:", error);
    return NextResponse.json(
      { error: "Failed to list campaigns" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - write operations
    const rateLimitResponse = applyRateLimit(request, "write", "campaigns");
    if (rateLimitResponse) return rateLimitResponse;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.organizationId) {
      return NextResponse.json(
        { error: "Organization required" },
        { status: 400 }
      );
    }

    // Validate request body
    const validation = await parseAndValidateBody(request, createCampaignSchema);
    if (!validation.success) {
      return validation.error;
    }

    const {
      name,
      description,
      flowId,
      scheduledStart,
      scheduledEnd,
      allowedHoursStart,
      allowedHoursEnd,
      allowedDays,
      timezone,
      maxAttempts,
      retryIntervalHours,
      concurrentCalls,
    } = validation.data;

    // Verify flow exists if provided
    if (flowId) {
      const flow = await getFlowById(flowId, user.organizationId);
      if (!flow) {
        return NextResponse.json(
          { error: "Flow not found" },
          { status: 404 }
        );
      }
    }

    const campaign = await createCampaign(user.organizationId, {
      name,
      description,
      flowId,
      scheduledStart,
      scheduledEnd,
      allowedHoursStart,
      allowedHoursEnd,
      allowedDays,
      timezone,
      maxAttempts,
      retryIntervalHours,
      concurrentCalls,
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestMetadata(request);
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "campaign_create",
      entityType: "campaign",
      entityId: campaign.id,
      newValues: { name, flowId, status: "draft" },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error("Create campaign error:", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}