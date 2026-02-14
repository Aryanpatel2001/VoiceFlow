/**
 * Contact List Items API Route
 *
 * GET /api/contact-lists/[id]/items - List contacts in a list
 * POST /api/contact-lists/[id]/items - Add contacts (JSON or CSV)
 * DELETE /api/contact-lists/[id]/items - Delete contacts from list
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import {
  getContactListById,
  getContactsFromList,
  addContactsToList,
  deleteContactsFromList,
} from "@/services/contact-list.service";
import { parseContactsCsv } from "@/lib/campaign/csv-parser";
import {
  validateQuery,
  parseAndValidateBody,
  listContactsQuerySchema,
  addContactListItemsSchema,
} from "@/lib/validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const rateLimitResponse = applyRateLimit(request, "read", "contact-lists");
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

    const { id } = await context.params;

    const list = await getContactListById(id, user.organizationId);
    if (!list) {
      return NextResponse.json(
        { error: "Contact list not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const validation = validateQuery(listContactsQuerySchema, searchParams);
    if (!validation.success) {
      return validation.error;
    }

    const { search, limit, offset } = validation.data;

    const result = await getContactsFromList(id, { search }, { limit, offset });

    return NextResponse.json(result);
  } catch (error) {
    console.error("List contact list items error:", error);
    return NextResponse.json(
      { error: "Failed to list contacts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const rateLimitResponse = applyRateLimit(request, "write", "contact-lists");
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

    const { id } = await context.params;

    const list = await getContactListById(id, user.organizationId);
    if (!list) {
      return NextResponse.json(
        { error: "Contact list not found" },
        { status: 404 }
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

      // Check file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: "File size exceeds 10MB limit" },
          { status: 400 }
        );
      }

      const csvContent = await file.text();
      const { contacts: parsedContacts, errors } = parseContactsCsv(csvContent);

      if (parsedContacts.length === 0) {
        return NextResponse.json(
          {
            error: "No valid contacts found in CSV",
            details: errors.slice(0, 5),
          },
          { status: 400 }
        );
      }

      const added = await addContactsToList(id, parsedContacts);

      return NextResponse.json({
        added,
        total: list.total_contacts + added,
        valid: parsedContacts.length,
        errors: errors.slice(0, 10),
      });
    }

    // Handle JSON body
    const validation = await parseAndValidateBody(request, addContactListItemsSchema);
    if (!validation.success) {
      return validation.error;
    }

    const { contacts } = validation.data;

    const added = await addContactsToList(id, contacts);

    return NextResponse.json({
      added,
      total: list.total_contacts + added,
    });
  } catch (error) {
    console.error("Add contacts to list error:", error);
    return NextResponse.json(
      { error: "Failed to add contacts" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const rateLimitResponse = applyRateLimit(request, "write", "contact-lists");
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

    const { id } = await context.params;

    const list = await getContactListById(id, user.organizationId);
    if (!list) {
      return NextResponse.json(
        { error: "Contact list not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { contactIds } = body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: "contactIds array is required" },
        { status: 400 }
      );
    }

    const deleted = await deleteContactsFromList(contactIds, id);

    return NextResponse.json({ deleted });
  } catch (error) {
    console.error("Delete contacts from list error:", error);
    return NextResponse.json(
      { error: "Failed to delete contacts" },
      { status: 500 }
    );
  }
}
