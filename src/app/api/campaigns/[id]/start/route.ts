/**
 * Start Campaign API Route
 *
 * POST /api/campaigns/[id]/start - Start a campaign
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import { getRequestMetadata } from "@/lib/request-meta";
import {
  getCampaignById,
  updateCampaignStatus,
  getCampaignStats,
} from "@/services/campaign.service";
import { getFlowById } from "@/services/flow.service";
import { createAuditLog } from "@/services/audit.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting - write operations
    const rateLimitResponse = applyRateLimit(request, "write", "campaigns/[id]/start");
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

    // Validate campaign can start
    if (!["draft", "paused"].includes(campaign.status)) {
      return NextResponse.json(
        { error: `Cannot start campaign with status: ${campaign.status}` },
        { status: 400 }
      );
    }

    // Check if campaign has contacts
    const stats = await getCampaignStats(id);
    if (stats.total === 0) {
      return NextResponse.json(
        { error: "Cannot start campaign with no contacts" },
        { status: 400 }
      );
    }

    // Check if all contacts are already processed
    if (stats.pending === 0) {
      return NextResponse.json(
        { error: "No pending contacts to call" },
        { status: 400 }
      );
    }

    // Verify flow is assigned
    if (!campaign.flow_id) {
      return NextResponse.json(
        { error: "Campaign must have a flow assigned" },
        { status: 400 }
      );
    }

    // Verify flow is published
    const flow = await getFlowById(campaign.flow_id, user.organizationId);
    if (!flow) {
      return NextResponse.json(
        { error: "Assigned flow not found" },
        { status: 404 }
      );
    }

    if (flow.status !== "published") {
      return NextResponse.json(
        { error: "Campaign flow must be published before starting" },
        { status: 400 }
      );
    }

    await updateCampaignStatus(id, "running");

    // Audit log
    const { ipAddress, userAgent } = getRequestMetadata(request);
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "campaign_start",
      entityType: "campaign",
      entityId: id,
      oldValues: { status: campaign.status },
      newValues: { status: "running" },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      status: "running",
      message: "Campaign started successfully",
    });
  } catch (error) {
    console.error("Start campaign error:", error);
    return NextResponse.json(
      { error: "Failed to start campaign" },
      { status: 500 }
    );
  }
}
