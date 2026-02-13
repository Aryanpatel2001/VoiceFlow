/**
 * Profile Settings API
 *
 * GET  /api/settings/profile - Get user profile
 * PATCH /api/settings/profile - Update user profile
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import {
  getUserProfile,
  updateUserProfile,
} from "@/services/settings.service";
import { createAuditLog } from "@/services/audit.service";
import { getRequestMetadata } from "@/lib/request-meta";

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = applyRateLimit(request, "read", "settings/profile");
    if (rateLimitResponse) return rateLimitResponse;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getUserProfile(user.id);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = applyRateLimit(request, "write", "settings/profile");
    if (rateLimitResponse) return rateLimitResponse;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { firstName, lastName } = body;

    // Validate input
    if (firstName !== undefined && typeof firstName !== "string") {
      return NextResponse.json(
        { error: "First name must be a string" },
        { status: 400 }
      );
    }

    if (lastName !== undefined && typeof lastName !== "string") {
      return NextResponse.json(
        { error: "Last name must be a string" },
        { status: 400 }
      );
    }

    // Get current profile for audit log
    const currentProfile = await getUserProfile(user.id);

    // Update profile
    const success = await updateUserProfile(user.id, {
      firstName: firstName?.trim(),
      lastName: lastName?.trim(),
    });

    if (!success) {
      return NextResponse.json(
        { error: "No changes to save" },
        { status: 400 }
      );
    }

    // Audit log
    const meta = getRequestMetadata(request);
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "update_profile",
      entityType: "user",
      entityId: user.id,
      oldValues: {
        firstName: currentProfile?.firstName,
        lastName: currentProfile?.lastName,
      },
      newValues: { firstName, lastName },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    // Get updated profile
    const updatedProfile = await getUserProfile(user.id);

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("Profile PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
