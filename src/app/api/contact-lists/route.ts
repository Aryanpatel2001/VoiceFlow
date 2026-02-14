/**
 * Contact Lists API Route
 *
 * GET /api/contact-lists - List contact lists for organization
 * POST /api/contact-lists - Create a new contact list
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import { getRequestMetadata } from "@/lib/request-meta";
import {
  createContactList,
  getContactListsByOrganization,
} from "@/services/contact-list.service";
import { createAuditLog } from "@/services/audit.service";
import {
  validateQuery,
  parseAndValidateBody,
  listContactListsQuerySchema,
  createContactListSchema,
} from "@/lib/validation";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const validation = validateQuery(listContactListsQuerySchema, searchParams);
    if (!validation.success) {
      return validation.error;
    }

    const { search, limit, offset } = validation.data;

    const result = await getContactListsByOrganization(
      user.organizationId,
      { search },
      { limit, offset }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("List contact lists error:", error);
    return NextResponse.json(
      { error: "Failed to list contact lists" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const validation = await parseAndValidateBody(request, createContactListSchema);
    if (!validation.success) {
      return validation.error;
    }

    const { name, description } = validation.data;

    const list = await createContactList(user.organizationId, user.id, {
      name,
      description,
    });

    const { ipAddress, userAgent } = getRequestMetadata(request);
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "contact_list_create",
      entityType: "contact_list",
      entityId: list.id,
      newValues: { name },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ list }, { status: 201 });
  } catch (error) {
    console.error("Create contact list error:", error);
    return NextResponse.json(
      { error: "Failed to create contact list" },
      { status: 500 }
    );
  }
}
