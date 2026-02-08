/**
 * Pause Campaign API Route
 *
 * POST /api/campaigns/[id]/pause - Pause a running campaign
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import { getRequestMetadata } from "@/lib/request-meta";
import {
  getCampaignById,
  updateCampaignStatus,
} from "@/services/campaign.service";
import { createAuditLog } from "@/services/audit.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting - write operations
    const rateLimitResponse = applyRateLimit(request, "write", "campaigns/[id]/pause");
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

    // Validate campaign can be paused
    if (campaign.status !== "running") {
      return NextResponse.json(
        { error: `Cannot pause campaign with status: ${campaign.status}` },
        { status: 400 }
      );
    }

    await updateCampaignStatus(id, "paused");

    // Audit log
    const { ipAddress, userAgent } = getRequestMetadata(request);
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "campaign_pause",
      entityType: "campaign",
      entityId: id,
      oldValues: { status: "running" },
      newValues: { status: "paused" },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      status: "paused",
      message: "Campaign paused successfully",
    });
  } catch (error) {
    console.error("Pause campaign error:", error);
    return NextResponse.json(
      { error: "Failed to pause campaign" },
      { status: 500 }
    );
  }
}
