/**
 * Phone Numbers API
 *
 * GET  /api/phone-numbers - List organization phone numbers
 * POST /api/phone-numbers - Purchase or add a phone number
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getPhoneNumbers,
  purchasePhoneNumber,
  addPhoneNumber,
  searchAvailableNumbers,
} from "@/services/phone.service";

// GET - List phone numbers
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.organizationId) {
      return NextResponse.json({ error: "Organization required" }, { status: 400 });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    // Search available numbers
    if (action === "search") {
      const country = url.searchParams.get("country") || "US";
      const areaCode = url.searchParams.get("areaCode") || undefined;
      const contains = url.searchParams.get("contains") || undefined;

      try {
        const numbers = await searchAvailableNumbers(country, {
          areaCode,
          contains,
          limit: 10,
        });
        return NextResponse.json({ numbers });
      } catch (error) {
        return NextResponse.json(
          { error: "Twilio not configured. Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to .env.local" },
          { status: 503 }
        );
      }
    }

    // List organization numbers
    const numbers = await getPhoneNumbers(user.organizationId);

    return NextResponse.json({
      numbers,
      total: numbers.length,
    });
  } catch (error) {
    console.error("Get phone numbers error:", error);
    return NextResponse.json(
      { error: "Failed to get phone numbers" },
      { status: 500 }
    );
  }
}

// POST - Purchase or add phone number
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.organizationId) {
      return NextResponse.json({ error: "Organization required" }, { status: 400 });
    }

    const body = await request.json();
    const { number, friendlyName, mode } = body;

    if (!number) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    let phoneNumber;

    if (mode === "purchase") {
      // Purchase from Twilio
      phoneNumber = await purchasePhoneNumber(
        user.organizationId,
        number,
        friendlyName
      );
    } else {
      // Manual add (for testing)
      phoneNumber = await addPhoneNumber(user.organizationId, {
        number,
        friendlyName,
      });
    }

    return NextResponse.json({ phoneNumber }, { status: 201 });
  } catch (error) {
    console.error("Add phone number error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add phone number" },
      { status: 500 }
    );
  }
}
