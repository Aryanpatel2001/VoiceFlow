/**
 * Campaign Contacts API Route
 *
 * GET /api/campaigns/[id]/contacts - List contacts
 * POST /api/campaigns/[id]/contacts - Add contacts (JSON or CSV)
 * DELETE /api/campaigns/[id]/contacts - Delete all contacts
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import {
  getCampaignById,
  getContacts,
  addContacts,
  deleteContact,
  deleteContacts,
  bulkUpdateContactStatus,
  type ContactStatus,
} from "@/services/campaign.service";
import { parseContactsCsv } from "@/lib/campaign/csv-parser";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting - read operations
    const rateLimitResponse = applyRateLimit(request, "read", "campaigns/[id]/contacts");
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
    const campaign = await getCampaignById(id, user.organizationId);
    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as ContactStatus | null;
    const search = searchParams.get("search");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const orderBy = searchParams.get("orderBy");
    const order = searchParams.get("order") as "asc" | "desc" | null;

    const result = await getContacts(
      id,
      {
        status: status || undefined,
        search: search || undefined,
      },
      {
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
        orderBy: orderBy || undefined,
        order: order || undefined,
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("List contacts error:", error);
    return NextResponse.json(
      { error: "Failed to list contacts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting - write operations
    const rateLimitResponse = applyRateLimit(request, "write", "campaigns/[id]/contacts");
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
    const campaign = await getCampaignById(id, user.organizationId);
    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Cannot add contacts to completed campaigns
    if (campaign.status === "completed") {
      return NextResponse.json(
        { error: "Cannot add contacts to a completed campaign" },
        { status: 400 }
      );
    }

    const contentType = request.headers.get("content-type") || "";

    // Handle CSV upload
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      const csvContent = await file.text();
      const parseResult = parseContactsCsv(csvContent);

      if (parseResult.contacts.length === 0) {
        return NextResponse.json(
          {
            error: "No valid contacts found in CSV",
            errors: parseResult.errors,
          },
          { status: 400 }
        );
      }

      const added = await addContacts(id, parseResult.contacts);

      return NextResponse.json({
        added,
        total: parseResult.totalRows,
        valid: parseResult.validRows,
        errors: parseResult.errors,
      });
    }

    // Handle JSON body
    const body = await request.json();
    const contacts = Array.isArray(body) ? body : [body];

    // Validate contacts
    for (const contact of contacts) {
      if (!contact.phoneNumber) {
        return NextResponse.json(
          { error: "phoneNumber is required for each contact" },
          { status: 400 }
        );
      }
    }

    const added = await addContacts(
      id,
      contacts.map((c) => ({
        phoneNumber: c.phoneNumber,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        customData: c.customData,
      }))
    );

    return NextResponse.json({ added }, { status: 201 });
  } catch (error) {
    console.error("Add contacts error:", error);
    return NextResponse.json(
      { error: "Failed to add contacts" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/campaigns/[id]/contacts
 * Delete contacts from a campaign
 * Body: { contactIds: string[] } for specific contacts
 * Query: ?all=true to delete all contacts
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting - write operations
    const rateLimitResponse = applyRateLimit(request, "write", "campaigns/[id]/contacts");
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
    const campaign = await getCampaignById(id, user.organizationId);
    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Cannot delete contacts from running campaigns
    if (campaign.status === "running") {
      return NextResponse.json(
        { error: "Cannot delete contacts from a running campaign. Pause the campaign first." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const deleteAll = searchParams.get("all") === "true";

    if (deleteAll) {
      // Delete all contacts (get IDs first)
      const allContacts = await getContacts(id, {}, { limit: 10000 });
      const contactIds = allContacts.contacts.map(c => c.id);

      if (contactIds.length === 0) {
        return NextResponse.json({ deleted: 0 });
      }

      const deleted = await deleteContacts(contactIds, id);
      return NextResponse.json({ deleted });
    }

    // Delete specific contacts from body
    const body = await request.json();
    const contactIds = body.contactIds;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: "contactIds array is required" },
        { status: 400 }
      );
    }

    // Validate contactIds are strings
    if (!contactIds.every(id => typeof id === "string")) {
      return NextResponse.json(
        { error: "All contactIds must be strings" },
        { status: 400 }
      );
    }

    const deleted = await deleteContacts(contactIds, id);
    return NextResponse.json({ deleted });
  } catch (error) {
    console.error("Delete contacts error:", error);
    return NextResponse.json(
      { error: "Failed to delete contacts" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/campaigns/[id]/contacts
 * Bulk update contact status
 * Body: { contactIds: string[], status: ContactStatus }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting - write operations
    const rateLimitResponse = applyRateLimit(request, "write", "campaigns/[id]/contacts");
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
    const campaign = await getCampaignById(id, user.organizationId);
    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { contactIds, status } = body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: "contactIds array is required" },
        { status: 400 }
      );
    }

    const validStatuses: ContactStatus[] = ["pending", "in_progress", "completed", "failed", "dnc"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Only allow manual status changes to certain statuses
    const manuallySettableStatuses: ContactStatus[] = ["pending", "dnc"];
    if (!manuallySettableStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Can only manually set status to: ${manuallySettableStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const updated = await bulkUpdateContactStatus(contactIds, id, status);
    return NextResponse.json({ updated });
  } catch (error) {
    console.error("Update contacts error:", error);
    return NextResponse.json(
      { error: "Failed to update contacts" },
      { status: 500 }
    );
  }
}
