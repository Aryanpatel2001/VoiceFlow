/**
 * Team API Routes
 *
 * GET  /api/team - List team members
 * POST /api/team - Invite a new team member
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import {
  getTeamMembers,
  inviteTeamMember,
  getTeamStats,
  isOrgAdmin,
} from "@/services/team.service";
import { createAuditLog } from "@/services/audit.service";
import { getRequestMetadata } from "@/lib/request-meta";

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = applyRateLimit(request, "read", "team");
    if (rateLimitResult) return rateLimitResult;

    // Auth check
    const user = await getAuthenticatedUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get team members
    const [members, stats] = await Promise.all([
      getTeamMembers(user.organizationId),
      getTeamStats(user.organizationId),
    ]);

    return NextResponse.json({
      members,
      stats,
    });
  } catch (error) {
    console.error("Error fetching team:", error);
    return NextResponse.json(
      { error: "Failed to fetch team members" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = applyRateLimit(request, "write", "team");
    if (rateLimitResult) return rateLimitResult;

    // Auth check
    const user = await getAuthenticatedUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const canInvite = await isOrgAdmin(user.organizationId, user.id);
    if (!canInvite) {
      return NextResponse.json(
        { error: "Only admins can invite team members" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role } = body;

    // Validate input
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    if (!role || !["admin", "member"].includes(role)) {
      return NextResponse.json(
        { error: "Role must be 'admin' or 'member'" },
        { status: 400 }
      );
    }

    // Invite member
    const result = await inviteTeamMember(
      user.organizationId,
      email.toLowerCase().trim(),
      role,
      user.id
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Audit log
    const meta = getRequestMetadata(request);
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "invite_team_member",
      entityType: "team",
      newValues: { email, role },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error inviting team member:", error);
    return NextResponse.json(
      { error: "Failed to invite team member" },
      { status: 500 }
    );
  }
}
