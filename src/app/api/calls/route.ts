/**
 * Calls API Route
 *
 * GET /api/calls - List calls for the organization
 * POST /api/calls - Create a new call record
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getCallsByOrganization,
  createCall,
  type CallFilters,
  type PaginationOptions,
} from "@/services/call.service";

export async function GET(request: Request) {
  try {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);

    const filters: CallFilters = {};
    if (searchParams.get("status")) {
      filters.status = searchParams.get("status") as CallFilters["status"];
    }
    if (searchParams.get("direction")) {
      filters.direction = searchParams.get("direction") as CallFilters["direction"];
    }
    if (searchParams.get("startDate")) {
      filters.startDate = new Date(searchParams.get("startDate")!);
    }
    if (searchParams.get("endDate")) {
      filters.endDate = new Date(searchParams.get("endDate")!);
    }
    if (searchParams.get("phoneNumber")) {
      filters.phoneNumber = searchParams.get("phoneNumber")!;
    }
    if (searchParams.get("flowId")) {
      filters.flowId = searchParams.get("flowId")!;
    }

    const pagination: PaginationOptions = {
      limit: parseInt(searchParams.get("limit") || "50", 10),
      offset: parseInt(searchParams.get("offset") || "0", 10),
      orderBy:
        (searchParams.get("orderBy") as PaginationOptions["orderBy"]) ||
        "started_at",
      order: (searchParams.get("order") as PaginationOptions["order"]) || "desc",
    };

    const { calls, total } = await getCallsByOrganization(
      user.organizationId,
      filters,
      pagination
    );

    return NextResponse.json({
      calls,
      total,
      limit: pagination.limit,
      offset: pagination.offset,
    });
  } catch (error) {
    console.error("Get calls error:", error);
    return NextResponse.json(
      { error: "Failed to fetch calls" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
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

    const body = await request.json();
    const { direction, callerNumber, calleeNumber, flowId, phoneNumberId, metadata } =
      body;

    // Validate required fields
    if (!direction || !callerNumber || !calleeNumber) {
      return NextResponse.json(
        { error: "direction, callerNumber, and calleeNumber are required" },
        { status: 400 }
      );
    }

    if (!["inbound", "outbound"].includes(direction)) {
      return NextResponse.json(
        { error: "direction must be 'inbound' or 'outbound'" },
        { status: 400 }
      );
    }

    const call = await createCall({
      organizationId: user.organizationId,
      direction,
      callerNumber,
      calleeNumber,
      flowId,
      phoneNumberId,
      metadata,
    });

    return NextResponse.json({ call }, { status: 201 });
  } catch (error) {
    console.error("Create call error:", error);
    return NextResponse.json(
      { error: "Failed to create call" },
      { status: 500 }
    );
  }
}
