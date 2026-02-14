import { NextRequest, NextResponse } from "next/server";

export function getRequestMetadata(req: NextRequest): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || realIp || null;
  const userAgent = req.headers.get("user-agent");
  return { ipAddress, userAgent };
}

export function rateLimitResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}
