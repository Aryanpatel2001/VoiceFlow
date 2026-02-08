/**
 * Campaign Detail API Route
 *
 * GET /api/campaigns/[id] - Get campaign details
 * PATCH /api/campaigns/[id] - Update campaign
 * DELETE /api/campaigns/[id] - Delete campaign
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import { getRequestMetadata } from "@/lib/request-meta";
import {
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  getCampaignStats,
} from "@/services/campaign.service";
import { getFlowById } from "@/services/flow.service";
import { createAuditLog } from "@/services/audit.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting - read operations
    const rateLimitResponse = applyRateLimit(request, "read", "campaigns/[id]");
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

    const { id } = await params;

    const campaign = await getCampaignById(id, user.organizationId);
    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Get detailed stats
    const stats = await getCampaignStats(id);

    return NextResponse.json({ campaign, stats });
  } catch (error) {
    console.error("Get campaign error:", error);
    return NextResponse.json(
      { error: "Failed to get campaign" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting - write operations
    const rateLimitResponse = applyRateLimit(request, "write", "campaigns/[id]");
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

    const { id } = await params;
    const body = await request.json();

    // Verify campaign exists
    const existing = await getCampaignById(id, user.organizationId);
    if (!existing) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Cannot edit running campaigns (except to pause)
    if (existing.status === "running") {
      return NextResponse.json(
        { error: "Cannot edit a running campaign. Pause it first." },
        { status: 400 }
      );
    }

    // Verify flow if changing it
    if (body.flowId && body.flowId !== existing.flow_id) {
      const flow = await getFlowById(body.flowId, user.organizationId);
      if (!flow) {
        return NextResponse.json(
          { error: "Flow not found" },
          { status: 404 }
        );
      }
    }

    const campaign = await updateCampaign(id, user.organizationId, {
      name: body.name,
      description: body.description,
      flowId: body.flowId,
      scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : body.scheduledStart,
      scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : body.scheduledEnd,
      allowedHoursStart: body.allowedHoursStart,
      allowedHoursEnd: body.allowedHoursEnd,
      allowedDays: body.allowedDays,
      timezone: body.timezone,
      maxAttempts: body.maxAttempts,
      retryIntervalHours: body.retryIntervalHours,
      concurrentCalls: body.concurrentCalls,
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestMetadata(request);
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "campaign_update",
      entityType: "campaign",
      entityId: id,
      oldValues: { name: existing.name, flowId: existing.flow_id },
      newValues: { name: body.name, flowId: body.flowId },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error("Update campaign error:", error);
    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting - write operations
    const rateLimitResponse = applyRateLimit(request, "write", "campaigns/[id]");
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

    const { id } = await params;

    // Verify campaign exists
    const existing = await getCampaignById(id, user.organizationId);
    if (!existing) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Cannot delete running campaigns
    if (existing.status === "running") {
      return NextResponse.json(
        { error: "Cannot delete a running campaign. Pause it first." },
        { status: 400 }
      );
    }

    const deleted = await deleteCampaign(id, user.organizationId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete campaign" },
        { status: 500 }
      );
    }

    // Audit log
    const { ipAddress, userAgent } = getRequestMetadata(request);
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "campaign_delete",
      entityType: "campaign",
      entityId: id,
      oldValues: { name: existing.name, status: existing.status },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete campaign error:", error);
    return NextResponse.json(
      { error: "Failed to delete campaign" },
      { status: 500 }
    );
  }
}
