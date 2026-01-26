/**
 * Onboarding API Route
 *
 * Creates an organization for the authenticated user.
 * POST /api/onboarding
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  createOrganization,
  getUserOrganizations,
} from "@/services/user.service";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user already has an organization
    const existingOrgs = await getUserOrganizations(user.id);
    if (existingOrgs.length > 0) {
      return NextResponse.json(
        { error: "You already have an organization" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { companyName, industry, website, phone, timezone } = body;

    // Validate required fields
    if (!companyName || companyName.trim().length < 2) {
      return NextResponse.json(
        { error: "Company name must be at least 2 characters" },
        { status: 400 }
      );
    }

    // Create organization
    const org = await createOrganization(user.id, {
      name: companyName.trim(),
      industry: industry || undefined,
      website: website || undefined,
      phone: phone || undefined,
      timezone: timezone || undefined,
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
      },
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: "Failed to create organization. Please try again." },
      { status: 500 }
    );
  }
}
