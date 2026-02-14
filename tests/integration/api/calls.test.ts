/**
 * Calls API Integration Tests
 *
 * Tests for /api/calls endpoints.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { mockQuerySuccess, mockQuerySequence } from "../../mocks/db";
import { mockAuthenticatedUser } from "../../mocks/auth";

// Mock the modules
vi.mock("@/lib/db");
vi.mock("@/lib/auth");
vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(() => null),
}));

// Import handlers after mocking
import { GET } from "@/app/api/calls/route";

describe("Calls API", () => {
  const mockUser = {
    id: "user_123",
    organizationId: "org_123",
    email: "test@example.com",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedUser(mockUser);
  });

  // ============================================
  // GET /api/calls
  // ============================================
  describe("GET /api/calls", () => {
    it("should return calls for authenticated user", async () => {
      const mockCalls = [
        {
          id: "call_1",
          organization_id: "org_123",
          direction: "inbound",
          status: "completed",
          caller_number: "+15551234567",
          callee_number: "+15559876543",
          duration_seconds: 120,
          created_at: new Date(),
          started_at: new Date(),
          ended_at: new Date(),
        },
        {
          id: "call_2",
          organization_id: "org_123",
          direction: "outbound",
          status: "completed",
          caller_number: "+15559876543",
          callee_number: "+15551111111",
          duration_seconds: 60,
          created_at: new Date(),
          started_at: new Date(),
          ended_at: new Date(),
        },
      ];

      mockQuerySequence([
        [{ count: "2" }],
        mockCalls,
      ]);

      const request = new NextRequest("http://localhost:3000/api/calls");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.calls).toHaveLength(2);
      expect(data.total).toBe(2);
    });

    it("should filter calls by status", async () => {
      const mockCalls = [
        {
          id: "call_1",
          organization_id: "org_123",
          direction: "inbound",
          status: "completed",
          duration_seconds: 120,
          created_at: new Date(),
        },
      ];

      mockQuerySequence([
        [{ count: "1" }],
        mockCalls,
      ]);

      const request = new NextRequest("http://localhost:3000/api/calls?status=completed");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.calls).toHaveLength(1);
      expect(data.calls[0].status).toBe("completed");
    });

    it("should filter calls by direction", async () => {
      const mockCalls = [
        {
          id: "call_1",
          organization_id: "org_123",
          direction: "inbound",
          status: "completed",
          created_at: new Date(),
        },
      ];

      mockQuerySequence([
        [{ count: "1" }],
        mockCalls,
      ]);

      const request = new NextRequest("http://localhost:3000/api/calls?direction=inbound");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.calls).toHaveLength(1);
      expect(data.calls[0].direction).toBe("inbound");
    });

    it("should filter calls by date range", async () => {
      mockQuerySequence([
        [{ count: "5" }],
        [
          { id: "call_1", status: "completed", created_at: new Date("2024-01-15") },
          { id: "call_2", status: "completed", created_at: new Date("2024-01-20") },
        ],
      ]);

      const request = new NextRequest(
        "http://localhost:3000/api/calls?startDate=2024-01-01&endDate=2024-01-31"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.total).toBe(5);
    });

    it("should return 401 for unauthenticated request", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(null);

      const request = new NextRequest("http://localhost:3000/api/calls");
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it("should support pagination", async () => {
      mockQuerySequence([
        [{ count: "100" }],
        [{ id: "call_51", status: "completed", created_at: new Date() }],
      ]);

      const request = new NextRequest("http://localhost:3000/api/calls?limit=1&offset=50");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.total).toBe(100);
      expect(data.calls).toHaveLength(1);
    });

    it("should return empty array when no calls found", async () => {
      mockQuerySequence([
        [{ count: "0" }],
        [],
      ]);

      const request = new NextRequest("http://localhost:3000/api/calls");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.calls).toHaveLength(0);
      expect(data.total).toBe(0);
    });
  });
});
