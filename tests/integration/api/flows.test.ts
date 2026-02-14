/**
 * Flows API Integration Tests
 *
 * Tests for /api/flows endpoints.
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
import { GET, POST } from "@/app/api/flows/route";

describe("Flows API", () => {
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
  // GET /api/flows
  // ============================================
  describe("GET /api/flows", () => {
    it("should return flows for authenticated user", async () => {
      const mockFlows = [
        {
          id: "flow_1",
          name: "Test Flow 1",
          status: "draft",
          version: 1,
          agent_mode: "canvas",
          nodes: JSON.stringify([]),
          edges: JSON.stringify([]),
          variables: JSON.stringify([]),
          settings: JSON.stringify({}),
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: "flow_2",
          name: "Test Flow 2",
          status: "published",
          version: 2,
          agent_mode: "canvas",
          nodes: JSON.stringify([]),
          edges: JSON.stringify([]),
          variables: JSON.stringify([]),
          settings: JSON.stringify({}),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockQuerySequence([
        [{ count: "2" }],
        mockFlows,
      ]);

      const request = new NextRequest("http://localhost:3000/api/flows");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.flows).toHaveLength(2);
      expect(data.total).toBe(2);
    });

    it("should filter flows by status", async () => {
      const mockFlows = [
        {
          id: "flow_1",
          name: "Published Flow",
          status: "published",
          version: 1,
          agent_mode: "canvas",
          nodes: JSON.stringify([]),
          edges: JSON.stringify([]),
          variables: JSON.stringify([]),
          settings: JSON.stringify({}),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockQuerySequence([
        [{ count: "1" }],
        mockFlows,
      ]);

      const request = new NextRequest("http://localhost:3000/api/flows?status=published");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.flows).toHaveLength(1);
      expect(data.flows[0].status).toBe("published");
    });

    it("should return 401 for unauthenticated request", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(null);

      const request = new NextRequest("http://localhost:3000/api/flows");
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it("should support pagination", async () => {
      mockQuerySequence([
        [{ count: "100" }],
        [{ id: "flow_51", name: "Flow 51", status: "draft", agent_mode: "canvas", nodes: "[]", edges: "[]", variables: "[]", settings: "{}" }],
      ]);

      const request = new NextRequest("http://localhost:3000/api/flows?limit=1&offset=50");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.total).toBe(100);
    });
  });

  // ============================================
  // POST /api/flows
  // ============================================
  describe("POST /api/flows", () => {
    it("should create a new flow", async () => {
      const mockFlow = {
        id: "flow_new",
        organization_id: "org_123",
        name: "New Test Flow",
        description: "A test flow",
        status: "draft",
        version: 1,
        agent_mode: "canvas",
        nodes: JSON.stringify([]),
        edges: JSON.stringify([]),
        variables: JSON.stringify([]),
        settings: JSON.stringify({}),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuerySuccess([mockFlow]);

      const request = new NextRequest("http://localhost:3000/api/flows", {
        method: "POST",
        body: JSON.stringify({
          name: "New Test Flow",
          description: "A test flow",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe("flow_new");
      expect(data.name).toBe("New Test Flow");
    });

    it("should create a single_prompt mode flow", async () => {
      const mockFlow = {
        id: "flow_prompt",
        organization_id: "org_123",
        name: "Prompt Agent",
        status: "draft",
        version: 1,
        agent_mode: "single_prompt",
        nodes: JSON.stringify([]),
        edges: JSON.stringify([]),
        variables: JSON.stringify([]),
        settings: JSON.stringify({}),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuerySuccess([mockFlow]);

      const request = new NextRequest("http://localhost:3000/api/flows", {
        method: "POST",
        body: JSON.stringify({
          name: "Prompt Agent",
          agentMode: "single_prompt",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.agentMode).toBe("single_prompt");
    });

    it("should return 400 for missing name", async () => {
      const request = new NextRequest("http://localhost:3000/api/flows", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("should return 401 for unauthenticated request", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(null);

      const request = new NextRequest("http://localhost:3000/api/flows", {
        method: "POST",
        body: JSON.stringify({ name: "Test" }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });
});
