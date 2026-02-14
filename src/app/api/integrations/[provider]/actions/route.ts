/**
 * Integration Actions API
 *
 * GET: List available actions for a provider
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { getProvider, isValidProvider } from "@/lib/integrations";
import { applyRateLimit } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    // Rate limiting - integration read operations
    const rateLimitResponse = applyRateLimit(req, "integration", "integrations/[provider]/actions");
    if (rateLimitResponse) return rateLimitResponse;

    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { provider } = params;
    if (!isValidProvider(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const providerInstance = getProvider(provider);
    const actions = providerInstance.getActions();

    return NextResponse.json({ actions });
  } catch (error) {
    console.error("[Integrations] Actions error:", error);
    return NextResponse.json(
      { error: "Failed to list actions" },
      { status: 500 }
    );
  }
}
