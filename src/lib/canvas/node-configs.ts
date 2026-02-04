/**
 * Node Configurations
 *
 * Default configurations and metadata for each node type.
 * 6 simplified node types: Start, Conversation, Function, Call Transfer, Set Variable, End
 *
 * @module lib/canvas/node-configs
 */

import {
  Play,
  MessageSquare,
  Code,
  PhoneForwarded,
  Variable,
  Square,
  type LucideIcon,
} from "lucide-react";

import type {
  NodeType,
  StartConfig,
  ConversationConfig,
  FunctionConfig,
  CallTransferConfig,
  SetVariableConfig,
  EndConfig,
  NodeConfig,
  TransitionCondition,
} from "./types";

// ============================================
// Node Metadata
// ============================================

export interface NodeMeta {
  type: NodeType;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  category: "core" | "actions";
  hasInputHandle: boolean;
  hasOutputHandle: boolean;
  hasTransitions: boolean; // Node supports transition conditions
}

export const NODE_METADATA: Record<NodeType, NodeMeta> = {
  start: {
    type: "start",
    label: "Start",
    description: "Entry point - optionally greet the user",
    icon: Play,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950",
    category: "core",
    hasInputHandle: false,
    hasOutputHandle: true,
    hasTransitions: false,
  },
  conversation: {
    type: "conversation",
    label: "Conversation",
    description: "AI-powered dialogue with transitions",
    icon: MessageSquare,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950",
    category: "core",
    hasInputHandle: true,
    hasOutputHandle: false, // Uses transition handles instead
    hasTransitions: true,
  },
  function: {
    type: "function",
    label: "Function",
    description: "Execute API calls or custom code",
    icon: Code,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50 dark:bg-cyan-950",
    category: "actions",
    hasInputHandle: true,
    hasOutputHandle: false,
    hasTransitions: true,
  },
  call_transfer: {
    type: "call_transfer",
    label: "Call Transfer",
    description: "Transfer call to a phone number",
    icon: PhoneForwarded,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 dark:bg-yellow-950",
    category: "actions",
    hasInputHandle: true,
    hasOutputHandle: true, // Only "transfer_failed" handle
    hasTransitions: false,
  },
  set_variable: {
    type: "set_variable",
    label: "Set Variable",
    description: "Set or modify flow variables",
    icon: Variable,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    category: "actions",
    hasInputHandle: true,
    hasOutputHandle: true,
    hasTransitions: false,
  },
  end: {
    type: "end",
    label: "End",
    description: "End the call with optional farewell",
    icon: Square,
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950",
    category: "core",
    hasInputHandle: true,
    hasOutputHandle: false,
    hasTransitions: false,
  },
};

// ============================================
// Default Configurations
// ============================================

export const DEFAULT_START_CONFIG: StartConfig = {
  speaksFirst: true,
  greeting: {
    mode: "static",
    content: "Hello! How can I help you today?",
  },
};

export const DEFAULT_CONVERSATION_CONFIG: ConversationConfig = {
  content: {
    mode: "prompt",
    content: "",
  },
  transitions: [],
  skipResponse: false,
  blockInterruptions: false,
  model: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: 300,
};

export const DEFAULT_FUNCTION_CONFIG: FunctionConfig = {
  executionType: "http",
  method: "GET",
  url: "",
  headers: { "Content-Type": "application/json" },
  body: "",
  responseMapping: [],
  timeout: 10000,
  waitForResult: true,
  transitions: [],
};

export const DEFAULT_CALL_TRANSFER_CONFIG: CallTransferConfig = {
  destination: "",
  transferType: "cold",
};

export const DEFAULT_SET_VARIABLE_CONFIG: SetVariableConfig = {
  assignments: [
    {
      id: "assign_1",
      variable: "",
      value: "",
      operation: "set",
    },
  ],
};

export const DEFAULT_END_CONFIG: EndConfig = {
  speakDuringExecution: {
    mode: "static",
    content: "Thank you for calling. Goodbye!",
  },
  reason: "completed",
};

// ============================================
// Get Default Config by Type
// ============================================

export function getDefaultConfig(type: NodeType): NodeConfig {
  switch (type) {
    case "start":
      return { ...DEFAULT_START_CONFIG };
    case "conversation":
      return {
        ...DEFAULT_CONVERSATION_CONFIG,
        content: { ...DEFAULT_CONVERSATION_CONFIG.content },
        transitions: [],
      };
    case "function":
      return {
        ...DEFAULT_FUNCTION_CONFIG,
        headers: { ...DEFAULT_FUNCTION_CONFIG.headers },
        responseMapping: [],
        transitions: [],
      };
    case "call_transfer":
      return { ...DEFAULT_CALL_TRANSFER_CONFIG };
    case "set_variable":
      return {
        ...DEFAULT_SET_VARIABLE_CONFIG,
        assignments: DEFAULT_SET_VARIABLE_CONFIG.assignments.map((a) => ({ ...a })),
      };
    case "end":
      return {
        ...DEFAULT_END_CONFIG,
        speakDuringExecution: DEFAULT_END_CONFIG.speakDuringExecution
          ? { ...DEFAULT_END_CONFIG.speakDuringExecution }
          : undefined,
      };
    default:
      throw new Error(`Unknown node type: ${type}`);
  }
}

// ============================================
// Node Categories
// ============================================

export const NODE_CATEGORIES = [
  {
    name: "Core",
    description: "Essential flow nodes",
    nodes: ["start", "conversation", "end"] as NodeType[],
  },
  {
    name: "Actions",
    description: "Execute actions and modify data",
    nodes: ["function", "set_variable", "call_transfer"] as NodeType[],
  },
];

// ============================================
// Output Handles by Node Type
// ============================================

/**
 * Get output handles for a node.
 * - Nodes with transitions: handles come from transition conditions
 * - Start, Set Variable: single "default" output
 * - Call Transfer: "transfer_failed" output
 * - End: no outputs (terminal)
 */
export function getOutputHandles(type: NodeType, config?: NodeConfig): string[] {
  switch (type) {
    case "start":
    case "set_variable":
      return ["default"];

    case "conversation": {
      const convConfig = config as ConversationConfig | undefined;
      const transitionHandles = convConfig?.transitions?.map((t: TransitionCondition) => t.handle) || [];
      return transitionHandles;
    }

    case "function": {
      const fnConfig = config as FunctionConfig | undefined;
      const transitionHandles = fnConfig?.transitions?.map((t: TransitionCondition) => t.handle) || [];
      return transitionHandles;
    }

    case "call_transfer":
      return ["transfer_failed"];

    case "end":
      return []; // Terminal node

    default:
      return ["default"];
  }
}

// ============================================
// HTTP Methods
// ============================================

export const HTTP_METHODS = [
  { value: "GET", label: "GET", hasBody: false },
  { value: "POST", label: "POST", hasBody: true },
  { value: "PUT", label: "PUT", hasBody: true },
  { value: "PATCH", label: "PATCH", hasBody: true },
  { value: "DELETE", label: "DELETE", hasBody: false },
];

// ============================================
// Equation Operators (for transition conditions)
// ============================================

export const EQUATION_OPERATORS = [
  { value: "==", label: "equals (==)" },
  { value: "!=", label: "not equals (!=)" },
  { value: ">", label: "greater than (>)" },
  { value: "<", label: "less than (<)" },
  { value: ">=", label: "greater or equal (>=)" },
  { value: "<=", label: "less or equal (<=)" },
  { value: "CONTAINS", label: "contains" },
  { value: "NOT CONTAINS", label: "not contains" },
  { value: "exists", label: "exists" },
  { value: "not exists", label: "does not exist" },
];

// ============================================
// LLM Models
// ============================================

export const LLM_MODELS = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini (Fast, Low Cost)" },
  { value: "gpt-4o", label: "GPT-4o (Balanced)" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo (Best Quality)" },
];
