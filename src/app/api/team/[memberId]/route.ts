/**
 * Team Member API Routes
 *
 * GET    /api/team/[memberId] - Get member details
 * PATCH  /api/team/[memberId] - Update member role
 * DELETE /api/team/[memberId] - Remove member
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import {
  getTeamMember,
  updateMemberRole,
  removeMember,
  isOrgAdmin,
} from "@/services/team.service";
import { createAuditLog } from "@/services/audit.service";
import { getRequestMetadata } from "@/lib/request-meta";

interface RouteParams {
  params: { memberId: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimitResult = applyRateLimit(request, "read", "team-member");
    if (rateLimitResult) return rateLimitResult;

    const user = await getAuthenticatedUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const member = await getTeamMember(user.organizationId, params.memberId);

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error("Error fetching team member:", error);
    return NextResponse.json(
      { error: "Failed to fetch team member" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimitResult = applyRateLimit(request, "write", "team-member");
    if (rateLimitResult) return rateLimitResult;

    const user = await getAuthenticatedUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const canUpdate = await isOrgAdmin(user.organizationId, user.id);
    if (!canUpdate) {
      return NextResponse.json(
        { error: "Only admins can update team members" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { role } = body;

    if (!role || !["admin", "member"].includes(role)) {
      return NextResponse.json(
        { error: "Role must be 'admin' or 'member'" },
        { status: 400 }
      );
    }

    // Get current member for audit
    const currentMember = await getTeamMember(user.organizationId, params.memberId);
    if (!currentMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const success = await updateMemberRole(
      user.organizationId,
      params.memberId,
      role
    );

    if (!success) {
      return NextResponse.json(
        { error: "Cannot update this member's role" },
        { status: 400 }
      );
    }

    // Audit log
    const meta = getRequestMetadata(request);
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "update_team_member",
      entityType: "team",
      entityId: params.memberId,
      oldValues: { role: currentMember.role },
      newValues: { role },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating team member:", error);
    return NextResponse.json(
      { error: "Failed to update team member" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimitResult = applyRateLimit(request, "write", "team-member");
    if (rateLimitResult) return rateLimitResult;

    const user = await getAuthenticatedUser();
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const canDelete = await isOrgAdmin(user.organizationId, user.id);
    if (!canDelete) {
      return NextResponse.json(
        { error: "Only admins can remove team members" },
        { status: 403 }
      );
    }

    // Get member for audit
    const member = await getTeamMember(user.organizationId, params.memberId);
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const success = await removeMember(user.organizationId, params.memberId);

    if (!success) {
      return NextResponse.json(
        { error: "Cannot remove this member" },
        { status: 400 }
      );
    }

    // Audit log
    const meta = getRequestMetadata(request);
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "remove_team_member",
      entityType: "team",
      entityId: params.memberId,
      oldValues: { email: member.email, role: member.role },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing team member:", error);
    return NextResponse.json(
      { error: "Failed to remove team member" },
      { status: 500 }
    );
  }
}
