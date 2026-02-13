/**
 * Organization Settings API
 *
 * GET  /api/settings/organization - Get organization settings
 * PATCH /api/settings/organization - Update organization settings (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import {
  getOrganizationSettings,
  updateOrganizationSettings,
} from "@/services/settings.service";
import { isOrgAdmin } from "@/services/team.service";
import { createAuditLog } from "@/services/audit.service";
import { getRequestMetadata } from "@/lib/request-meta";

const VALID_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
];

const VALID_INDUSTRIES = [
  "healthcare",
  "real_estate",
  "legal",
  "home_services",
  "hospitality",
  "automotive",
  "financial",
  "retail",
  "technology",
  "other",
];

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = applyRateLimit(request, "read", "settings/organization");
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

    const settings = await getOrganizationSettings(user.organizationId);
    if (!settings) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Organization settings GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch organization settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = applyRateLimit(request, "write", "settings/organization");
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

    // Check if user is admin
    const canUpdate = await isOrgAdmin(user.organizationId, user.id);
    if (!canUpdate) {
      return NextResponse.json(
        { error: "Only admins can update organization settings" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, industry, timezone, website, phone } = body;

    // Validate inputs
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Organization name is required" },
          { status: 400 }
        );
      }
      if (name.length > 255) {
        return NextResponse.json(
          { error: "Organization name is too long" },
          { status: 400 }
        );
      }
    }

    if (industry !== undefined && industry !== "") {
      if (!VALID_INDUSTRIES.includes(industry)) {
        return NextResponse.json(
          { error: "Invalid industry" },
          { status: 400 }
        );
      }
    }

    if (timezone !== undefined) {
      if (!VALID_TIMEZONES.includes(timezone)) {
        return NextResponse.json(
          { error: "Invalid timezone" },
          { status: 400 }
        );
      }
    }

    // Get current settings for audit log
    const currentSettings = await getOrganizationSettings(user.organizationId);

    // Update settings
    const success = await updateOrganizationSettings(user.organizationId, {
      name: name?.trim(),
      industry: industry || null,
      timezone,
      website: website?.trim() || null,
      phone: phone?.trim() || null,
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
      action: "update_organization_settings",
      entityType: "organization",
      entityId: user.organizationId,
      oldValues: {
        name: currentSettings?.name,
        industry: currentSettings?.industry,
        timezone: currentSettings?.timezone,
      },
      newValues: { name, industry, timezone },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    // Get updated settings
    const updatedSettings = await getOrganizationSettings(user.organizationId);

    return NextResponse.json({
      success: true,
      settings: updatedSettings,
    });
  } catch (error) {
    console.error("Organization settings PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update organization settings" },
      { status: 500 }
    );
  }
}
