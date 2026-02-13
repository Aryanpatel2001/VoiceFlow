/**
 * Notification Settings API
 *
 * GET  /api/settings/notifications - Get notification preferences
 * PATCH /api/settings/notifications - Update notification preferences
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/services/settings.service";
import { createAuditLog } from "@/services/audit.service";
import { getRequestMetadata } from "@/lib/request-meta";

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = applyRateLimit(request, "read", "settings/notifications");
    if (rateLimitResponse) return rateLimitResponse;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const preferences = await getNotificationPreferences(user.id);

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error("Notification preferences GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification preferences" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = applyRateLimit(request, "write", "settings/notifications");
    if (rateLimitResponse) return rateLimitResponse;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { emailNotifications, callAlerts, weeklyReport } = body;

    // Validate inputs (must be booleans if provided)
    if (emailNotifications !== undefined && typeof emailNotifications !== "boolean") {
      return NextResponse.json(
        { error: "emailNotifications must be a boolean" },
        { status: 400 }
      );
    }

    if (callAlerts !== undefined && typeof callAlerts !== "boolean") {
      return NextResponse.json(
        { error: "callAlerts must be a boolean" },
        { status: 400 }
      );
    }

    if (weeklyReport !== undefined && typeof weeklyReport !== "boolean") {
      return NextResponse.json(
        { error: "weeklyReport must be a boolean" },
        { status: 400 }
      );
    }

    // Get current preferences for audit log
    const currentPrefs = await getNotificationPreferences(user.id);

    // Build update object with only provided fields
    const updates: { emailNotifications?: boolean; callAlerts?: boolean; weeklyReport?: boolean } = {};
    if (emailNotifications !== undefined) updates.emailNotifications = emailNotifications;
    if (callAlerts !== undefined) updates.callAlerts = callAlerts;
    if (weeklyReport !== undefined) updates.weeklyReport = weeklyReport;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No changes to save" },
        { status: 400 }
      );
    }

    // Update preferences
    const success = await updateNotificationPreferences(user.id, updates);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to save preferences" },
        { status: 500 }
      );
    }

    // Audit log
    const meta = getRequestMetadata(request);
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "update_notification_preferences",
      entityType: "user",
      entityId: user.id,
      oldValues: { ...currentPrefs },
      newValues: { ...updates },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    // Get updated preferences
    const updatedPrefs = await getNotificationPreferences(user.id);

    return NextResponse.json({
      success: true,
      preferences: updatedPrefs,
    });
  } catch (error) {
    console.error("Notification preferences PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update notification preferences" },
      { status: 500 }
    );
  }
}
