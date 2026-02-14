/**
 * Single Contact List API Route
 *
 * GET /api/contact-lists/[id] - Get contact list details
 * PATCH /api/contact-lists/[id] - Update contact list
 * DELETE /api/contact-lists/[id] - Delete contact list
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import { getRequestMetadata } from "@/lib/request-meta";
import {
  getContactListById,
  updateContactList,
  deleteContactList,
} from "@/services/contact-list.service";
import { createAuditLog } from "@/services/audit.service";
import { parseAndValidateBody, updateContactListSchema } from "@/lib/validation";

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

    return NextResponse.json({ list });
  } catch (error) {
    console.error("Get contact list error:", error);
    return NextResponse.json(
      { error: "Failed to get contact list" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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

    const existingList = await getContactListById(id, user.organizationId);
    if (!existingList) {
      return NextResponse.json(
        { error: "Contact list not found" },
        { status: 404 }
      );
    }

    const validation = await parseAndValidateBody(request, updateContactListSchema);
    if (!validation.success) {
      return validation.error;
    }

    const list = await updateContactList(id, user.organizationId, validation.data);

    const { ipAddress, userAgent } = getRequestMetadata(request);
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "contact_list_update",
      entityType: "contact_list",
      entityId: id,
      oldValues: { name: existingList.name },
      newValues: validation.data,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ list });
  } catch (error) {
    console.error("Update contact list error:", error);
    return NextResponse.json(
      { error: "Failed to update contact list" },
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

    const existingList = await getContactListById(id, user.organizationId);
    if (!existingList) {
      return NextResponse.json(
        { error: "Contact list not found" },
        { status: 404 }
      );
    }

    const deleted = await deleteContactList(id, user.organizationId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete contact list" },
        { status: 500 }
      );
    }

    const { ipAddress, userAgent } = getRequestMetadata(request);
    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "contact_list_delete",
      entityType: "contact_list",
      entityId: id,
      oldValues: { name: existingList.name },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete contact list error:", error);
    return NextResponse.json(
      { error: "Failed to delete contact list" },
      { status: 500 }
    );
  }
}
