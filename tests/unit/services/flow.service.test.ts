/**
 * Flow Service Tests
 *
 * Unit tests for the flow service module.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { query } from "@/lib/db";
import {
  createFlow,
  getFlowById,
  getFlowsByOrganization,
  updateFlow,
  deleteFlow,
  publishFlow,
} from "@/services/flow.service";
import { mockQuerySuccess, mockQueryError, mockQuerySequence, mockQueryWithRowCount } from "../../mocks/db";

// Mock the validation module
vi.mock("@/lib/canvas/validation", () => ({
  validateFlow: vi.fn(() => ({ valid: true, errors: [], warnings: [] })),
}));

vi.mock("@/lib/prompt-agent", () => ({
  mergeSinglePromptConfig: vi.fn((config) => config || {}),
  validateSinglePromptConfig: vi.fn(() => ({ valid: true, errors: [] })),
}));

describe("Flow Service", () => {
  const mockOrgId = "org_test123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // createFlow
  // ============================================
  describe("createFlow", () => {
    it("should create a new flow with default values", async () => {
      const mockFlow = {
        id: "flow_123",
        organization_id: mockOrgId,
        name: "Test Flow",
        description: null,
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

      const result = await createFlow(mockOrgId, { name: "Test Flow" });

      expect(result).toBeDefined();
      expect(result.id).toBe("flow_123");
      expect(result.name).toBe("Test Flow");
      expect(query).toHaveBeenCalledTimes(1);
    });

    it("should create a flow with custom nodes and edges", async () => {
      const customNodes = [
        {
          id: "start_1",
          type: "start" as const,
          position: { x: 100, y: 100 },
          data: { label: "Custom Start", config: { speaksFirst: true, greeting: { mode: "static" as const, content: "Hi there!" } } },
        },
      ];

      const mockFlow = {
        id: "flow_456",
        organization_id: mockOrgId,
        name: "Custom Flow",
        description: "A custom flow",
        status: "draft",
        version: 1,
        agent_mode: "canvas",
        nodes: JSON.stringify(customNodes),
        edges: JSON.stringify([]),
        variables: JSON.stringify([]),
        settings: JSON.stringify({}),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuerySuccess([mockFlow]);

      const result = await createFlow(mockOrgId, {
        name: "Custom Flow",
        description: "A custom flow",
        nodes: customNodes,
      });

      expect(result).toBeDefined();
      expect(result.name).toBe("Custom Flow");
    });

    it("should create a single_prompt mode flow", async () => {
      const mockFlow = {
        id: "flow_789",
        organization_id: mockOrgId,
        name: "Prompt Agent",
        status: "draft",
        version: 1,
        agent_mode: "single_prompt",
        nodes: JSON.stringify([]),
        edges: JSON.stringify([]),
        variables: JSON.stringify([]),
        settings: JSON.stringify({ promptConfig: {} }),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuerySuccess([mockFlow]);

      const result = await createFlow(mockOrgId, {
        name: "Prompt Agent",
        agentMode: "single_prompt",
      });

      expect(result).toBeDefined();
      expect(result.agentMode).toBe("single_prompt");
    });

    it("should throw error on database failure", async () => {
      mockQueryError(new Error("Database connection failed"));

      await expect(
        createFlow(mockOrgId, { name: "Test Flow" })
      ).rejects.toThrow("Database connection failed");
    });
  });

  // ============================================
  // getFlowById
  // ============================================
  describe("getFlowById", () => {
    it("should return a flow by ID", async () => {
      const mockFlow = {
        id: "flow_123",
        organization_id: mockOrgId,
        name: "Test Flow",
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

      const result = await getFlowById("flow_123", mockOrgId);

      expect(result).toBeDefined();
      expect(result?.id).toBe("flow_123");
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT"),
        ["flow_123", mockOrgId]
      );
    });

    it("should return null for non-existent flow", async () => {
      mockQuerySuccess([]);

      const result = await getFlowById("non_existent", mockOrgId);

      expect(result).toBeNull();
    });

    it("should return null if flow belongs to different org", async () => {
      mockQuerySuccess([]);

      const result = await getFlowById("flow_123", "different_org");

      expect(result).toBeNull();
    });
  });

  // ============================================
  // getFlowsByOrganization
  // ============================================
  describe("getFlowsByOrganization", () => {
    it("should return all flows for an organization", async () => {
      const mockFlows = [
        {
          id: "flow_1",
          organization_id: mockOrgId,
          name: "Flow 1",
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
          organization_id: mockOrgId,
          name: "Flow 2",
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

      // Mock count query first, then flows query
      mockQuerySequence([
        [{ count: "2" }],
        mockFlows,
      ]);

      const result = await getFlowsByOrganization(mockOrgId);

      expect(result.flows).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("should filter flows by status", async () => {
      const mockFlows = [
        {
          id: "flow_1",
          organization_id: mockOrgId,
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

      const result = await getFlowsByOrganization(mockOrgId, { status: "published" });

      expect(result.flows).toHaveLength(1);
      expect(result.flows[0].status).toBe("published");
    });

    it("should return empty array for org with no flows", async () => {
      mockQuerySequence([
        [{ count: "0" }],
        [],
      ]);

      const result = await getFlowsByOrganization(mockOrgId);

      expect(result.flows).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should support pagination", async () => {
      const mockFlows = [
        {
          id: "flow_3",
          organization_id: mockOrgId,
          name: "Flow 3",
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
      ];

      mockQuerySequence([
        [{ count: "5" }],
        mockFlows,
      ]);

      const result = await getFlowsByOrganization(mockOrgId, { limit: 1, offset: 2 });

      expect(result.flows).toHaveLength(1);
      expect(result.total).toBe(5);
    });
  });

  // ============================================
  // updateFlow
  // ============================================
  describe("updateFlow", () => {
    it("should update flow name", async () => {
      const existingFlow = {
        id: "flow_123",
        organization_id: mockOrgId,
        name: "Old Name",
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

      const mockUpdatedFlow = {
        ...existingFlow,
        name: "Updated Name",
        version: 2,
      };

      // updateFlow calls getFlowById first, then UPDATE query
      mockQuerySequence([
        [existingFlow],      // getFlowById query
        [mockUpdatedFlow],   // UPDATE query
      ]);

      const result = await updateFlow("flow_123", mockOrgId, { name: "Updated Name" });

      expect(result).toBeDefined();
      expect(result?.name).toBe("Updated Name");
    });

    it("should update flow nodes and edges", async () => {
      const newNodes = [
        {
          id: "node_1",
          type: "start" as const,
          position: { x: 0, y: 0 },
          data: { label: "New Start", config: {} },
        },
      ];

      const existingFlow = {
        id: "flow_123",
        organization_id: mockOrgId,
        name: "Test Flow",
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

      const mockUpdatedFlow = {
        ...existingFlow,
        version: 2,
        nodes: JSON.stringify(newNodes),
      };

      // updateFlow calls getFlowById first, then UPDATE query
      mockQuerySequence([
        [existingFlow],      // getFlowById query
        [mockUpdatedFlow],   // UPDATE query
      ]);

      const result = await updateFlow("flow_123", mockOrgId, { nodes: newNodes });

      expect(result).toBeDefined();
      expect(result?.flowData.nodes).toHaveLength(1);
    });

    it("should return null for non-existent flow", async () => {
      // getFlowById returns empty for non-existent flow
      mockQuerySuccess([]);

      const result = await updateFlow("non_existent", mockOrgId, { name: "New Name" });

      expect(result).toBeNull();
    });
  });

  // ============================================
  // deleteFlow
  // ============================================
  describe("deleteFlow", () => {
    it("should delete a flow and return true", async () => {
      mockQueryWithRowCount(1);

      const result = await deleteFlow("flow_123", mockOrgId);

      expect(result).toBe(true);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE"),
        expect.arrayContaining(["flow_123", mockOrgId])
      );
    });

    it("should return false for non-existent flow", async () => {
      mockQueryWithRowCount(0);

      const result = await deleteFlow("non_existent", mockOrgId);

      expect(result).toBe(false);
    });
  });

  // ============================================
  // publishFlow
  // ============================================
  describe("publishFlow", () => {
    it("should publish a flow and create version", async () => {
      const mockFlow = {
        id: "flow_123",
        organization_id: mockOrgId,
        name: "Test Flow",
        status: "draft",
        version: 1,
        agent_mode: "canvas",
        nodes: JSON.stringify([{ id: "start_1", type: "start", position: { x: 0, y: 0 }, data: {} }]),
        edges: JSON.stringify([]),
        variables: JSON.stringify([]),
        settings: JSON.stringify({}),
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockVersion = {
        id: "version_1",
        flow_id: "flow_123",
        version: 1,
        nodes: mockFlow.nodes,
        edges: mockFlow.edges,
        variables: mockFlow.variables,
        settings: mockFlow.settings,
        created_by: "user_123",
        created_at: new Date(),
      };

      // Mock: get flow, get max version, create version, update flow status
      mockQuerySequence([
        [mockFlow],                    // getFlowById
        [{ max_version: null }],       // get max version
        [mockVersion],                 // insert version
        [],                            // update flow status
      ]);

      const result = await publishFlow("flow_123", mockOrgId, "user_123");

      expect(result).toBeDefined();
      expect(result?.versionNumber).toBe(1);
    });

    it("should return null for non-existent flow", async () => {
      mockQuerySuccess([]);

      const result = await publishFlow("non_existent", mockOrgId, "user_123");

      expect(result).toBeNull();
    });
  });
});
