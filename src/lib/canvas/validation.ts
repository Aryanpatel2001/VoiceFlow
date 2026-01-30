/**
 * Flow Validation
 *
 * Validates flow structure, node configurations, and connections.
 * Ensures flows are complete and error-free before publishing.
 *
 * @module lib/canvas/validation
 */

import type {
  FlowNode,
  FlowEdge,
  FlowVariable,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  AIAgentConfig,
  ConditionConfig,
  SetVariableConfig,
  APICallConfig,
  TransferConfig,
  KnowledgeBaseConfig,
  FunctionConfig,
} from "./types";
import { getOutputHandles } from "./node-configs";

// ============================================
// Main Validation Function
// ============================================

export function validateFlow(
  nodes: FlowNode[],
  edges: FlowEdge[],
  variables: FlowVariable[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Structure validations
  validateStartNode(nodes, errors);
  validateOrphanedNodes(nodes, edges, errors);
  validateConnections(nodes, edges, errors);
  validateNoInfiniteLoops(nodes, edges, warnings);

  // Node-specific validations
  for (const node of nodes) {
    const nodeErrors = validateNode(node, variables);
    errors.push(...nodeErrors);
  }

  // Variable validations
  validateVariables(nodes, variables, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================
// Structure Validations
// ============================================

function validateStartNode(nodes: FlowNode[], errors: ValidationError[]): void {
  const startNodes = nodes.filter((n) => n.type === "start");

  if (startNodes.length === 0) {
    errors.push({
      message: "Flow must have a Start node",
      code: "NO_START_NODE",
    });
  } else if (startNodes.length > 1) {
    errors.push({
      message: "Flow can only have one Start node",
      code: "MULTIPLE_START_NODES",
    });
  }
}

function validateOrphanedNodes(
  nodes: FlowNode[],
  edges: FlowEdge[],
  errors: ValidationError[]
): void {
  const startNode = nodes.find((n) => n.type === "start");
  if (!startNode) return;

  const connectedNodeIds = new Set<string>();
  const queue = [startNode.id];

  // BFS to find all reachable nodes
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (connectedNodeIds.has(nodeId)) continue;
    connectedNodeIds.add(nodeId);

    const outgoingEdges = edges.filter((e) => e.source === nodeId);
    for (const edge of outgoingEdges) {
      if (!connectedNodeIds.has(edge.target)) {
        queue.push(edge.target);
      }
    }
  }

  // Find orphaned nodes
  for (const node of nodes) {
    if (node.type !== "start" && !connectedNodeIds.has(node.id)) {
      errors.push({
        nodeId: node.id,
        message: `Node "${node.data.label}" is not connected to the flow`,
        code: "ORPHANED_NODE",
      });
    }
  }
}

function validateConnections(
  nodes: FlowNode[],
  edges: FlowEdge[],
  errors: ValidationError[]
): void {
  for (const node of nodes) {
    // Skip terminal nodes
    if (node.type === "transfer" || node.type === "end_call") continue;

    const isStartNode = node.type === "start";

    // Check if node has outgoing connections
    const outgoingEdges = edges.filter((e) => e.source === node.id);

    if (outgoingEdges.length === 0) {
      // Start node might not have connections in empty flow
      const hasNodesAfterStart = nodes.length > 1;
      if (isStartNode && !hasNodesAfterStart) continue;

      if (!isStartNode) {
        errors.push({
          nodeId: node.id,
          message: `Node "${node.data.label}" has no outgoing connections`,
          code: "NO_OUTGOING_CONNECTION",
        });
      }
    }

    // Check condition nodes have all branches connected
    if (node.type === "condition") {
      const expectedHandles = getOutputHandles("condition", node.data.config);
      for (const handle of expectedHandles) {
        const hasEdge = outgoingEdges.some((e) => e.sourceHandle === handle);
        if (!hasEdge) {
          errors.push({
            nodeId: node.id,
            message: `Condition "${node.data.label}" is missing connection for "${handle}" branch`,
            code: "MISSING_BRANCH_CONNECTION",
          });
        }
      }
    }

    // Check API call nodes have error handle
    if (node.type === "api_call") {
      const hasErrorHandle = outgoingEdges.some((e) => e.sourceHandle === "error");
      if (!hasErrorHandle) {
        errors.push({
          nodeId: node.id,
          message: `API Call "${node.data.label}" should have an error connection`,
          code: "MISSING_ERROR_HANDLE",
        });
      }
    }
  }
}

function validateNoInfiniteLoops(
  nodes: FlowNode[],
  edges: FlowEdge[],
  warnings: ValidationWarning[]
): void {
  // Detect cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(nodeId: string, path: string[]): boolean {
    if (recursionStack.has(nodeId)) {
      // Found a cycle
      const cycleStart = path.indexOf(nodeId);
      const cycle = path.slice(cycleStart);
      warnings.push({
        nodeId,
        message: `Potential infinite loop detected: ${cycle.join(" -> ")} -> ${nodeId}`,
        code: "POTENTIAL_INFINITE_LOOP",
      });
      return true;
    }

    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const outgoingEdges = edges.filter((e) => e.source === nodeId);
    for (const edge of outgoingEdges) {
      dfs(edge.target, [...path, nodeId]);
    }

    recursionStack.delete(nodeId);
    return false;
  }

  const startNode = nodes.find((n) => n.type === "start");
  if (startNode) {
    dfs(startNode.id, []);
  }
}

// ============================================
// Node-Specific Validations
// ============================================

export function validateNode(
  node: FlowNode,
  variables: FlowVariable[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  const config = node.data.config;

  switch (node.type) {
    case "ai_agent":
      validateAIAgentNode(node, config as AIAgentConfig, errors);
      break;
    case "condition":
      validateConditionNode(node, config as ConditionConfig, variables, errors);
      break;
    case "set_variable":
      validateSetVariableNode(node, config as SetVariableConfig, variables, errors);
      break;
    case "api_call":
      validateAPICallNode(node, config as APICallConfig, errors);
      break;
    case "transfer":
      validateTransferNode(node, config as TransferConfig, errors);
      break;
    case "knowledge_base":
      validateKnowledgeBaseNode(node, config as KnowledgeBaseConfig, errors);
      break;
    case "function":
      validateFunctionNode(node, config as FunctionConfig, errors);
      break;
  }

  return errors;
}

function validateAIAgentNode(
  node: FlowNode,
  config: AIAgentConfig,
  errors: ValidationError[]
): void {
  if (!config.systemPrompt || config.systemPrompt.trim() === "") {
    errors.push({
      nodeId: node.id,
      field: "systemPrompt",
      message: "AI Agent requires a prompt",
      code: "MISSING_PROMPT",
    });
  }

  if (config.mode === "structured") {
    if (!config.responses || config.responses.length === 0) {
      errors.push({
        nodeId: node.id,
        field: "responses",
        message: "Structured mode requires at least one response",
        code: "MISSING_RESPONSES",
      });
    }
  }

  if (config.temperature !== undefined) {
    if (config.temperature < 0 || config.temperature > 2) {
      errors.push({
        nodeId: node.id,
        field: "temperature",
        message: "Temperature must be between 0 and 2",
        code: "INVALID_TEMPERATURE",
      });
    }
  }
}

function validateConditionNode(
  node: FlowNode,
  config: ConditionConfig,
  variables: FlowVariable[],
  errors: ValidationError[]
): void {
  if (!config.rules || config.rules.length === 0) {
    errors.push({
      nodeId: node.id,
      field: "rules",
      message: "Condition requires at least one rule",
      code: "MISSING_RULES",
    });
    return;
  }

  const variableNames = new Set(variables.map((v) => v.name));

  for (const rule of config.rules) {
    if (!rule.variable) {
      errors.push({
        nodeId: node.id,
        field: "rules",
        message: "Condition rule is missing a variable",
        code: "MISSING_RULE_VARIABLE",
      });
    } else if (!variableNames.has(rule.variable) && !rule.variable.startsWith("{{")) {
      errors.push({
        nodeId: node.id,
        field: "rules",
        message: `Variable "${rule.variable}" is not defined`,
        code: "UNDEFINED_VARIABLE",
      });
    }

    if (!rule.outputHandle) {
      errors.push({
        nodeId: node.id,
        field: "rules",
        message: "Condition rule is missing an output handle",
        code: "MISSING_OUTPUT_HANDLE",
      });
    }
  }
}

function validateSetVariableNode(
  node: FlowNode,
  config: SetVariableConfig,
  variables: FlowVariable[],
  errors: ValidationError[]
): void {
  if (!config.assignments || config.assignments.length === 0) {
    errors.push({
      nodeId: node.id,
      field: "assignments",
      message: "Set Variable requires at least one assignment",
      code: "MISSING_ASSIGNMENTS",
    });
    return;
  }

  const variableNames = new Set(variables.map((v) => v.name));

  for (const assignment of config.assignments) {
    if (!assignment.variable) {
      errors.push({
        nodeId: node.id,
        field: "assignments",
        message: "Assignment is missing a variable name",
        code: "MISSING_VARIABLE_NAME",
      });
    } else if (!variableNames.has(assignment.variable)) {
      errors.push({
        nodeId: node.id,
        field: "assignments",
        message: `Variable "${assignment.variable}" is not defined. Add it to flow variables first.`,
        code: "UNDEFINED_VARIABLE",
      });
    }
  }
}

function validateAPICallNode(
  node: FlowNode,
  config: APICallConfig,
  errors: ValidationError[]
): void {
  if (!config.url || config.url.trim() === "") {
    errors.push({
      nodeId: node.id,
      field: "url",
      message: "API Call requires a URL",
      code: "MISSING_URL",
    });
  } else {
    // Validate URL format (allow templates)
    const urlWithoutTemplates = config.url.replace(/\{\{[^}]+\}\}/g, "placeholder");
    try {
      new URL(urlWithoutTemplates);
    } catch {
      errors.push({
        nodeId: node.id,
        field: "url",
        message: "Invalid URL format",
        code: "INVALID_URL",
      });
    }
  }

  if (["POST", "PUT", "PATCH"].includes(config.method)) {
    if (config.body) {
      try {
        // Try parsing as JSON (ignoring templates)
        const bodyWithoutTemplates = config.body.replace(/\{\{[^}]+\}\}/g, '"placeholder"');
        JSON.parse(bodyWithoutTemplates);
      } catch {
        // Body might be intentionally non-JSON, just warn
      }
    }
  }
}

function validateTransferNode(
  node: FlowNode,
  config: TransferConfig,
  errors: ValidationError[]
): void {
  if (!config.destination || config.destination.trim() === "") {
    errors.push({
      nodeId: node.id,
      field: "destination",
      message: "Transfer requires a destination",
      code: "MISSING_DESTINATION",
    });
  }

  if (config.type === "phone" && config.destination) {
    // Basic phone validation
    const phoneRegex = /^[+]?[\d\s()-]{10,}$/;
    if (!phoneRegex.test(config.destination.replace(/\{\{[^}]+\}\}/g, "1234567890"))) {
      errors.push({
        nodeId: node.id,
        field: "destination",
        message: "Invalid phone number format",
        code: "INVALID_PHONE",
      });
    }
  }
}

function validateKnowledgeBaseNode(
  node: FlowNode,
  config: KnowledgeBaseConfig,
  errors: ValidationError[]
): void {
  if (!config.datasetId || config.datasetId.trim() === "") {
    errors.push({
      nodeId: node.id,
      field: "datasetId",
      message: "Knowledge Base requires a dataset",
      code: "MISSING_DATASET",
    });
  }

  if (!config.query || config.query.trim() === "") {
    errors.push({
      nodeId: node.id,
      field: "query",
      message: "Knowledge Base requires a query",
      code: "MISSING_QUERY",
    });
  }

  if (config.topK < 1 || config.topK > 10) {
    errors.push({
      nodeId: node.id,
      field: "topK",
      message: "Top K must be between 1 and 10",
      code: "INVALID_TOP_K",
    });
  }

  if (config.minScore < 0 || config.minScore > 1) {
    errors.push({
      nodeId: node.id,
      field: "minScore",
      message: "Minimum score must be between 0 and 1",
      code: "INVALID_MIN_SCORE",
    });
  }
}

function validateFunctionNode(
  node: FlowNode,
  config: FunctionConfig,
  errors: ValidationError[]
): void {
  if (!config.code || config.code.trim() === "") {
    errors.push({
      nodeId: node.id,
      field: "code",
      message: "Function requires code",
      code: "MISSING_CODE",
    });
  }

  // Basic syntax check
  if (config.code) {
    try {
      // Try to parse as function body
      new Function("inputs", config.code);
    } catch (e) {
      errors.push({
        nodeId: node.id,
        field: "code",
        message: `JavaScript syntax error: ${e instanceof Error ? e.message : "Unknown error"}`,
        code: "SYNTAX_ERROR",
      });
    }
  }

  if (config.timeout < 100 || config.timeout > 30000) {
    errors.push({
      nodeId: node.id,
      field: "timeout",
      message: "Timeout must be between 100ms and 30 seconds",
      code: "INVALID_TIMEOUT",
    });
  }
}

// ============================================
// Variable Validations
// ============================================

function validateVariables(
  nodes: FlowNode[],
  variables: FlowVariable[],
  warnings: ValidationWarning[]
): void {
  const usedVariables = new Set<string>();

  // Collect all variable references from nodes
  for (const node of nodes) {
    const configStr = JSON.stringify(node.data.config);
    const matches = configStr.match(/\{\{(\w+)\}\}/g);
    if (matches) {
      for (const match of matches) {
        const varName = match.replace(/\{\{|\}\}/g, "");
        usedVariables.add(varName);
      }
    }
  }

  // Check for unused variables
  for (const variable of variables) {
    if (!usedVariables.has(variable.name)) {
      warnings.push({
        message: `Variable "${variable.name}" is defined but never used`,
        code: "UNUSED_VARIABLE",
      });
    }
  }

  // Check for duplicate variable names
  const names = variables.map((v) => v.name);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  new Set(duplicates).forEach((dup) => {
    warnings.push({
      message: `Duplicate variable name: "${dup}"`,
      code: "DUPLICATE_VARIABLE",
    });
  });
}

// ============================================
// Quick Validation (for real-time feedback)
// ============================================

export function quickValidateNode(
  node: FlowNode,
  variables: FlowVariable[]
): string[] {
  const errors = validateNode(node, variables);
  return errors.map((e) => e.message);
}
