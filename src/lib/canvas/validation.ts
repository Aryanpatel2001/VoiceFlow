/**
 * Flow Validation
 *
 * Validates flow structure, node configurations, and connections.
 * 6 node types: start, conversation, function, call_transfer, set_variable, end
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
  ConversationConfig,
  FunctionConfig,
  CallTransferConfig,
  SetVariableConfig,
  EndConfig,
  StartConfig,
} from "./types";

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
  validateConnections(nodes, edges, warnings);

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
  warnings: ValidationWarning[]
): void {
  for (const node of nodes) {
    // End nodes have no outputs
    if (node.type === "end") continue;

    const outgoingEdges = edges.filter((e) => e.source === node.id);

    // Nodes with transitions (conversation, function) - check transition handles
    if (node.type === "conversation" || node.type === "function") {
      const config = node.data.config as ConversationConfig | FunctionConfig;
      const transitions = config.transitions ?? [];

      for (const transition of transitions) {
        const hasEdge = outgoingEdges.some(
          (e) => e.sourceHandle === transition.handle
        );
        if (!hasEdge) {
          warnings.push({
            nodeId: node.id,
            message: `Transition "${transition.label || transition.condition}" has no connection`,
            code: "UNCONNECTED_TRANSITION",
          });
        }
      }
    }

    // Simple output nodes (start, set_variable) should have an outgoing edge
    if (node.type === "start" || node.type === "set_variable") {
      if (outgoingEdges.length === 0 && nodes.length > 1) {
        warnings.push({
          nodeId: node.id,
          message: `Node "${node.data.label}" has no outgoing connections`,
          code: "NO_OUTGOING_CONNECTION",
        });
      }
    }

    // Call transfer should have a transfer_failed connection
    if (node.type === "call_transfer") {
      const hasFailedEdge = outgoingEdges.some(
        (e) => e.sourceHandle === "transfer_failed"
      );
      if (!hasFailedEdge) {
        warnings.push({
          nodeId: node.id,
          message: `Call Transfer "${node.data.label}" has no "Transfer Failed" connection`,
          code: "MISSING_TRANSFER_FAILED",
        });
      }
    }
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
    case "start":
      validateStartConfig(node, config as StartConfig, errors);
      break;
    case "conversation":
      validateConversationConfig(node, config as ConversationConfig, errors);
      break;
    case "function":
      validateFunctionConfig(node, config as FunctionConfig, errors);
      break;
    case "call_transfer":
      validateCallTransferConfig(node, config as CallTransferConfig, errors);
      break;
    case "set_variable":
      validateSetVariableConfig(node, config as SetVariableConfig, variables, errors);
      break;
    case "end":
      validateEndConfig(node, config as EndConfig, errors);
      break;
  }

  return errors;
}

function validateStartConfig(
  node: FlowNode,
  config: StartConfig,
  errors: ValidationError[]
): void {
  if (config.speaksFirst && config.greeting) {
    if (!config.greeting.content || config.greeting.content.trim() === "") {
      errors.push({
        nodeId: node.id,
        field: "greeting.content",
        message: "Greeting message is empty",
        code: "EMPTY_GREETING",
      });
    }
  }
}

function validateConversationConfig(
  node: FlowNode,
  config: ConversationConfig,
  errors: ValidationError[]
): void {
  if (!config.content?.content || config.content.content.trim() === "") {
    errors.push({
      nodeId: node.id,
      field: "content",
      message: config.content?.mode === "static"
        ? "Static sentence is empty"
        : "Prompt is empty",
      code: "EMPTY_CONTENT",
    });
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

  // Validate transitions
  for (const transition of config.transitions ?? []) {
    if (!transition.condition || transition.condition.trim() === "") {
      errors.push({
        nodeId: node.id,
        field: "transitions",
        message: `Transition "${transition.label || "unnamed"}" has no condition`,
        code: "EMPTY_TRANSITION_CONDITION",
      });
    }
  }
}

function validateFunctionConfig(
  node: FlowNode,
  config: FunctionConfig,
  errors: ValidationError[]
): void {
  if (config.executionType === "http") {
    if (!config.url || config.url.trim() === "") {
      errors.push({
        nodeId: node.id,
        field: "url",
        message: "HTTP request requires a URL",
        code: "MISSING_URL",
      });
    } else {
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
  } else if (config.executionType === "code") {
    if (!config.code || config.code.trim() === "") {
      errors.push({
        nodeId: node.id,
        field: "code",
        message: "Custom code is empty",
        code: "MISSING_CODE",
      });
    } else {
      try {
        new Function("args", config.code);
      } catch (e) {
        errors.push({
          nodeId: node.id,
          field: "code",
          message: `JavaScript syntax error: ${e instanceof Error ? e.message : "Unknown error"}`,
          code: "SYNTAX_ERROR",
        });
      }
    }
  }

  if (config.timeout !== undefined && (config.timeout < 1000 || config.timeout > 30000)) {
    errors.push({
      nodeId: node.id,
      field: "timeout",
      message: "Timeout must be between 1000ms and 30000ms",
      code: "INVALID_TIMEOUT",
    });
  }

  // Validate transitions
  for (const transition of config.transitions ?? []) {
    if (!transition.condition || transition.condition.trim() === "") {
      errors.push({
        nodeId: node.id,
        field: "transitions",
        message: `Transition "${transition.label || "unnamed"}" has no condition`,
        code: "EMPTY_TRANSITION_CONDITION",
      });
    }
  }
}

function validateCallTransferConfig(
  node: FlowNode,
  config: CallTransferConfig,
  errors: ValidationError[]
): void {
  if (!config.destination || config.destination.trim() === "") {
    errors.push({
      nodeId: node.id,
      field: "destination",
      message: "Call Transfer requires a destination number",
      code: "MISSING_DESTINATION",
    });
  }
}

function validateSetVariableConfig(
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
        message: `Variable "${assignment.variable}" is not defined`,
        code: "UNDEFINED_VARIABLE",
      });
    }
  }
}

function validateEndConfig(
  _node: FlowNode,
  _config: EndConfig,
  _errors: ValidationError[]
): void {
  // End node has no required fields - farewell and reason are optional
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

  for (const variable of variables) {
    if (!usedVariables.has(variable.name)) {
      warnings.push({
        message: `Variable "${variable.name}" is defined but never used`,
        code: "UNUSED_VARIABLE",
      });
    }
  }

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
