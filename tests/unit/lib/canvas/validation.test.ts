/**
 * Canvas Validation Tests
 *
 * Unit tests for flow validation module.
 */

import { describe, it, expect } from "vitest";
import { validateFlow, validateNode, quickValidateNode } from "@/lib/canvas/validation";
import type { FlowNode, FlowEdge, FlowVariable } from "@/lib/canvas/types";

describe("Canvas Validation", () => {
  // ============================================
  // Helper Functions
  // ============================================
  const createStartNode = (id = "start_1", config = {}): FlowNode => ({
    id,
    type: "start",
    position: { x: 0, y: 0 },
    data: {
      label: "Start",
      config: {
        speaksFirst: true,
        greeting: { mode: "static", content: "Hello!" },
        ...config,
      },
    },
  });

  const createConversationNode = (id = "conv_1", config = {}): FlowNode => ({
    id,
    type: "conversation",
    position: { x: 200, y: 0 },
    data: {
      label: "Conversation",
      config: {
        content: { mode: "prompt", content: "How can I help you?" },
        transitions: [],
        ...config,
      },
    },
  });

  const createEndNode = (id = "end_1", config = {}): FlowNode => ({
    id,
    type: "end",
    position: { x: 400, y: 0 },
    data: {
      label: "End",
      config: {
        speakDuringExecution: { mode: "static", content: "Goodbye!" },
        reason: "completed",
        ...config,
      },
    },
  });

  const createEdge = (source: string, target: string, sourceHandle = "output"): FlowEdge => ({
    id: `${source}-${target}`,
    source,
    target,
    sourceHandle,
    targetHandle: "input",
  });

  // ============================================
  // validateFlow - Start Node
  // ============================================
  describe("validateFlow - Start Node", () => {
    it("should pass with a valid start node", () => {
      const nodes = [createStartNode()];
      const edges: FlowEdge[] = [];
      const variables: FlowVariable[] = [];

      const result = validateFlow(nodes, edges, variables);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail without a start node", () => {
      const nodes = [createEndNode()];
      const edges: FlowEdge[] = [];
      const variables: FlowVariable[] = [];

      const result = validateFlow(nodes, edges, variables);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("NO_START_NODE");
    });

    it("should fail with multiple start nodes", () => {
      const nodes = [createStartNode("start_1"), createStartNode("start_2")];
      const edges: FlowEdge[] = [];
      const variables: FlowVariable[] = [];

      const result = validateFlow(nodes, edges, variables);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "MULTIPLE_START_NODES")).toBe(true);
    });
  });

  // ============================================
  // validateFlow - Orphaned Nodes
  // ============================================
  describe("validateFlow - Orphaned Nodes", () => {
    it("should detect orphaned nodes not connected to flow", () => {
      const nodes = [
        createStartNode(),
        createConversationNode("conv_1"),
        createEndNode("end_1"),
      ];
      const edges = [createEdge("start_1", "end_1")]; // conv_1 is not connected
      const variables: FlowVariable[] = [];

      const result = validateFlow(nodes, edges, variables);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "ORPHANED_NODE")).toBe(true);
    });

    it("should pass when all nodes are connected", () => {
      const nodes = [
        createStartNode(),
        createConversationNode("conv_1"),
        createEndNode("end_1"),
      ];
      const edges = [
        createEdge("start_1", "conv_1"),
        createEdge("conv_1", "end_1"),
      ];
      const variables: FlowVariable[] = [];

      const result = validateFlow(nodes, edges, variables);

      expect(result.errors.filter((e) => e.code === "ORPHANED_NODE")).toHaveLength(0);
    });
  });

  // ============================================
  // validateFlow - Connections
  // ============================================
  describe("validateFlow - Connections", () => {
    it("should warn when start node has no outgoing connection", () => {
      const nodes = [createStartNode(), createEndNode()];
      const edges: FlowEdge[] = [];
      const variables: FlowVariable[] = [];

      const result = validateFlow(nodes, edges, variables);

      expect(result.warnings.some((w) => w.code === "NO_OUTGOING_CONNECTION")).toBe(true);
    });

    it("should warn when transition has no connection", () => {
      const nodes = [
        createStartNode(),
        createConversationNode("conv_1", {
          transitions: [{ id: "trans_1", type: "prompt" as const, handle: "yes", condition: "user says yes", label: "Yes" }],
        }),
      ];
      const edges = [createEdge("start_1", "conv_1")];
      const variables: FlowVariable[] = [];

      const result = validateFlow(nodes, edges, variables);

      expect(result.warnings.some((w) => w.code === "UNCONNECTED_TRANSITION")).toBe(true);
    });

    it("should warn when call_transfer has no transfer_failed connection", () => {
      const callTransferNode: FlowNode = {
        id: "transfer_1",
        type: "call_transfer",
        position: { x: 200, y: 0 },
        data: {
          label: "Transfer",
          config: { destination: "+15551234567", transferType: "cold" },
        },
      };

      const nodes = [createStartNode(), callTransferNode];
      const edges = [createEdge("start_1", "transfer_1")];
      const variables: FlowVariable[] = [];

      const result = validateFlow(nodes, edges, variables);

      expect(result.warnings.some((w) => w.code === "MISSING_TRANSFER_FAILED")).toBe(true);
    });
  });

  // ============================================
  // validateNode - Start Node
  // ============================================
  describe("validateNode - Start Node", () => {
    it("should pass with valid greeting", () => {
      const node = createStartNode();
      const errors = validateNode(node, []);

      expect(errors).toHaveLength(0);
    });

    it("should fail with empty greeting when speaksFirst is true", () => {
      const node = createStartNode("start_1", {
        speaksFirst: true,
        greeting: { mode: "static", content: "" },
      });
      const errors = validateNode(node, []);

      expect(errors.some((e) => e.code === "EMPTY_GREETING")).toBe(true);
    });

    it("should pass with empty greeting when speaksFirst is false", () => {
      const node = createStartNode("start_1", {
        speaksFirst: false,
        greeting: { mode: "static", content: "" },
      });
      const errors = validateNode(node, []);

      expect(errors).toHaveLength(0);
    });
  });

  // ============================================
  // validateNode - Conversation Node
  // ============================================
  describe("validateNode - Conversation Node", () => {
    it("should pass with valid content", () => {
      const node = createConversationNode();
      const errors = validateNode(node, []);

      expect(errors).toHaveLength(0);
    });

    it("should fail with empty content", () => {
      const node = createConversationNode("conv_1", {
        content: { mode: "prompt", content: "" },
      });
      const errors = validateNode(node, []);

      expect(errors.some((e) => e.code === "EMPTY_CONTENT")).toBe(true);
    });

    it("should fail with invalid temperature", () => {
      const node = createConversationNode("conv_1", {
        temperature: 3.0,
      });
      const errors = validateNode(node, []);

      expect(errors.some((e) => e.code === "INVALID_TEMPERATURE")).toBe(true);
    });

    it("should fail when transition has empty condition", () => {
      const node = createConversationNode("conv_1", {
        transitions: [{ id: "trans_2", type: "prompt" as const, handle: "yes", condition: "", label: "Yes" }],
      });
      const errors = validateNode(node, []);

      expect(errors.some((e) => e.code === "EMPTY_TRANSITION_CONDITION")).toBe(true);
    });
  });

  // ============================================
  // validateNode - Function Node
  // ============================================
  describe("validateNode - Function Node", () => {
    const createFunctionNode = (config = {}): FlowNode => ({
      id: "func_1",
      type: "function",
      position: { x: 200, y: 0 },
      data: {
        label: "Function",
        config: {
          executionType: "http",
          url: "https://api.example.com/endpoint",
          method: "GET",
          transitions: [],
          ...config,
        },
      },
    });

    it("should pass with valid HTTP config", () => {
      const node = createFunctionNode();
      const errors = validateNode(node, []);

      expect(errors).toHaveLength(0);
    });

    it("should fail with missing URL for HTTP type", () => {
      const node = createFunctionNode({ url: "" });
      const errors = validateNode(node, []);

      expect(errors.some((e) => e.code === "MISSING_URL")).toBe(true);
    });

    it("should fail with invalid URL format", () => {
      const node = createFunctionNode({ url: "not-a-valid-url" });
      const errors = validateNode(node, []);

      expect(errors.some((e) => e.code === "INVALID_URL")).toBe(true);
    });

    it("should allow URL with template variables", () => {
      const node = createFunctionNode({ url: "https://api.example.com/{{userId}}" });
      const errors = validateNode(node, []);

      expect(errors.filter((e) => e.code === "INVALID_URL")).toHaveLength(0);
    });

    it("should fail with empty code for code type", () => {
      const node = createFunctionNode({ executionType: "code", code: "" });
      const errors = validateNode(node, []);

      expect(errors.some((e) => e.code === "MISSING_CODE")).toBe(true);
    });

    it("should fail with invalid JavaScript syntax", () => {
      const node = createFunctionNode({
        executionType: "code",
        code: "function { invalid syntax",
      });
      const errors = validateNode(node, []);

      expect(errors.some((e) => e.code === "SYNTAX_ERROR")).toBe(true);
    });

    it("should pass with valid JavaScript code", () => {
      const node = createFunctionNode({
        executionType: "code",
        code: "return args.value * 2;",
      });
      const errors = validateNode(node, []);

      expect(errors.filter((e) => e.code === "SYNTAX_ERROR")).toHaveLength(0);
    });

    it("should fail with invalid timeout", () => {
      const node = createFunctionNode({ timeout: 100 }); // Below 1000ms
      const errors = validateNode(node, []);

      expect(errors.some((e) => e.code === "INVALID_TIMEOUT")).toBe(true);
    });
  });

  // ============================================
  // validateNode - Call Transfer Node
  // ============================================
  describe("validateNode - Call Transfer Node", () => {
    const createTransferNode = (config = {}): FlowNode => ({
      id: "transfer_1",
      type: "call_transfer",
      position: { x: 200, y: 0 },
      data: {
        label: "Transfer",
        config: {
          destination: "+15551234567",
          transferType: "cold",
          ...config,
        },
      },
    });

    it("should pass with valid destination", () => {
      const node = createTransferNode();
      const errors = validateNode(node, []);

      expect(errors).toHaveLength(0);
    });

    it("should fail with missing destination", () => {
      const node = createTransferNode({ destination: "" });
      const errors = validateNode(node, []);

      expect(errors.some((e) => e.code === "MISSING_DESTINATION")).toBe(true);
    });
  });

  // ============================================
  // validateNode - Set Variable Node
  // ============================================
  describe("validateNode - Set Variable Node", () => {
    const createSetVarNode = (config = {}): FlowNode => ({
      id: "setvar_1",
      type: "set_variable",
      position: { x: 200, y: 0 },
      data: {
        label: "Set Variable",
        config: {
          assignments: [{ id: "assign_1", variable: "userName", value: "John", operation: "set" as const }],
          ...config,
        },
      },
    });

    const variables: FlowVariable[] = [
      { id: "var_1", name: "userName", type: "string", defaultValue: "" },
    ];

    it("should pass with valid assignment to defined variable", () => {
      const node = createSetVarNode();
      const errors = validateNode(node, variables);

      expect(errors).toHaveLength(0);
    });

    it("should fail with no assignments", () => {
      const node = createSetVarNode({ assignments: [] });
      const errors = validateNode(node, variables);

      expect(errors.some((e) => e.code === "MISSING_ASSIGNMENTS")).toBe(true);
    });

    it("should fail with undefined variable", () => {
      const node = createSetVarNode({
        assignments: [{ id: "assign_2", variable: "undefinedVar", value: "test", operation: "set" as const }],
      });
      const errors = validateNode(node, variables);

      expect(errors.some((e) => e.code === "UNDEFINED_VARIABLE")).toBe(true);
    });

    it("should fail when variable name is missing", () => {
      const node = createSetVarNode({
        assignments: [{ id: "assign_3", variable: "", value: "test", operation: "set" as const }],
      });
      const errors = validateNode(node, variables);

      expect(errors.some((e) => e.code === "MISSING_VARIABLE_NAME")).toBe(true);
    });
  });

  // ============================================
  // Variable Validations
  // ============================================
  describe("Variable Validations", () => {
    it("should warn about unused variables", () => {
      const nodes = [createStartNode()];
      const edges: FlowEdge[] = [];
      const variables: FlowVariable[] = [
        { id: "var_unused", name: "unusedVar", type: "string", defaultValue: "" },
      ];

      const result = validateFlow(nodes, edges, variables);

      expect(result.warnings.some((w) => w.code === "UNUSED_VARIABLE")).toBe(true);
    });

    it("should warn about duplicate variable names", () => {
      const nodes = [createStartNode()];
      const edges: FlowEdge[] = [];
      const variables: FlowVariable[] = [
        { id: "var_dup1", name: "duplicateName", type: "string", defaultValue: "" },
        { id: "var_dup2", name: "duplicateName", type: "number", defaultValue: "0" },
      ];

      const result = validateFlow(nodes, edges, variables);

      expect(result.warnings.some((w) => w.code === "DUPLICATE_VARIABLE")).toBe(true);
    });

    it("should not warn when variable is used in template", () => {
      const nodes = [
        createStartNode("start_1", {
          greeting: { mode: "static", content: "Hello {{userName}}!" },
        }),
      ];
      const edges: FlowEdge[] = [];
      const variables: FlowVariable[] = [
        { id: "var_user", name: "userName", type: "string", defaultValue: "" },
      ];

      const result = validateFlow(nodes, edges, variables);

      expect(result.warnings.filter((w) => w.code === "UNUSED_VARIABLE")).toHaveLength(0);
    });
  });

  // ============================================
  // quickValidateNode
  // ============================================
  describe("quickValidateNode", () => {
    it("should return array of error messages", () => {
      const node = createConversationNode("conv_1", {
        content: { mode: "prompt", content: "" },
        temperature: 5.0,
      });
      const messages = quickValidateNode(node, []);

      expect(messages).toBeInstanceOf(Array);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.some((m) => m.includes("empty"))).toBe(true);
    });

    it("should return empty array for valid node", () => {
      const node = createConversationNode();
      const messages = quickValidateNode(node, []);

      expect(messages).toHaveLength(0);
    });
  });
});
