/**
 * Individual Phone Number API
 *
 * GET    /api/phone-numbers/[id] - Get phone number details
 * PATCH  /api/phone-numbers/[id] - Update phone number
 * DELETE /api/phone-numbers/[id] - Delete phone number
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getPhoneNumberById,
  updatePhoneNumber,
  deletePhoneNumber,
  assignFlow,
} from "@/services/phone.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - Get phone number details
export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.organizationId) {
      return NextResponse.json({ error: "Organization required" }, { status: 400 });
    }

    const { id } = await context.params;
    const phoneNumber = await getPhoneNumberById(id, user.organizationId);

    if (!phoneNumber) {
      return NextResponse.json({ error: "Phone number not found" }, { status: 404 });
    }

    return NextResponse.json({ phoneNumber });
  } catch (error) {
    console.error("Get phone number error:", error);
    return NextResponse.json(
      { error: "Failed to get phone number" },
      { status: 500 }
    );
  }
}

// PATCH - Update phone number (name, status, flow assignment)
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.organizationId) {
      return NextResponse.json({ error: "Organization required" }, { status: 400 });
    }

    const { id } = await context.params;
    const body = await request.json();

    // Handle flow assignment
    if ("assignedFlowId" in body) {
      const result = await assignFlow(id, user.organizationId, body.assignedFlowId);
      if (!result) {
        return NextResponse.json({ error: "Phone number not found" }, { status: 404 });
      }
      return NextResponse.json({ phoneNumber: result });
    }

    // Handle other updates
    const result = await updatePhoneNumber(id, user.organizationId, {
      friendlyName: body.friendlyName,
      status: body.status,
    });

    if (!result) {
      return NextResponse.json({ error: "Phone number not found" }, { status: 404 });
    }

    return NextResponse.json({ phoneNumber: result });
  } catch (error) {
    console.error("Update phone number error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update phone number" },
      { status: 500 }
    );
  }
}

// DELETE - Delete phone number
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.organizationId) {
      return NextResponse.json({ error: "Organization required" }, { status: 400 });
    }

    const { id } = await context.params;
    const deleted = await deletePhoneNumber(id, user.organizationId);

    if (!deleted) {
      return NextResponse.json({ error: "Phone number not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Phone number deleted" });
  } catch (error) {
    console.error("Delete phone number error:", error);
    return NextResponse.json(
      { error: "Failed to delete phone number" },
      { status: 500 }
    );
  }
}
