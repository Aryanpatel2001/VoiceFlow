/**
 * Canvas Types
 *
 * Core TypeScript interfaces for the Agent Canvas flow builder.
 * Simplified node system inspired by Retell AI:
 *   - Start, Conversation, Function, Call Transfer, Set Variable, End
 *   - Transitions built into nodes (Equation + Prompt types)
 *   - No separate listen/play_audio nodes - backend handles all audio
 *
 * @module lib/canvas/types
 */

import type { Node, Edge } from "@xyflow/react";

// ============================================
// Node Types (6 total)
// ============================================

export type NodeType =
  | "start"
  | "conversation"
  | "function"
  | "call_transfer"
  | "set_variable"
  | "end";

// ============================================
// Variable Types
// ============================================

export type VariableType = "string" | "number" | "boolean" | "enum";

export interface FlowVariable {
  id: string;
  name: string;
  type: VariableType;
  defaultValue?: unknown;
  description?: string;
  enumOptions?: string[]; // For enum type
}

// ============================================
// Transition System
// ============================================

/**
 * Transitions are built into nodes (mainly Conversation and Function).
 * Each transition has a condition and an output handle.
 * Transitions are evaluated when user finishes speaking (Conversation)
 * or when function completes (Function).
 *
 * Equation transitions are evaluated FIRST, top-to-bottom.
 * Prompt transitions are evaluated AFTER, top-to-bottom.
 * First TRUE wins → follow that edge.
 * If nothing matches → stay on current node.
 */

export type TransitionType = "equation" | "prompt";

export interface TransitionCondition {
  id: string;
  type: TransitionType;
  condition: string; // Equation: "{{name}} exists" | Prompt: "User wants to book"
  handle: string; // Output handle ID for this transition
  label?: string; // Display label for the transition
}

// ============================================
// Content Mode (Prompt vs Static)
// ============================================

export type ContentMode = "prompt" | "static";

export interface ContentConfig {
  mode: ContentMode;
  content: string; // Prompt instructions OR static sentence text
}

// ============================================
// Node Configuration Types
// ============================================

export interface BaseNodeData {
  label: string;
  validationErrors?: string[];
}

// --- Start Node ---
// Entry point. Optionally speaks a greeting.
export interface StartConfig {
  speaksFirst: boolean; // Agent speaks first or waits for user
  greeting?: ContentConfig; // If speaksFirst: prompt or static greeting
}

// --- Conversation Node ---
// THE main node. AI talks to users.
// Two modes: Prompt (dynamic AI) or Static (fixed text, then dynamic).
// Transitions evaluated when user finishes speaking.
export interface ConversationConfig {
  content: ContentConfig; // Prompt instructions or static sentence
  transitions: TransitionCondition[];
  skipResponse?: boolean; // Advance without waiting for user input
  blockInterruptions?: boolean; // Prevent user from interrupting
  model?: "gpt-4o-mini" | "gpt-4o" | "gpt-4-turbo";
  temperature?: number;
  maxTokens?: number;
}

// --- Function Node ---
// Executes HTTP calls or custom JS. Agent stays silent by default.
// Optionally speaks during execution ("Let me check that for you").
export interface FunctionConfig {
  // Execution type
  executionType: "http" | "code";

  // HTTP config (when executionType == "http")
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url?: string; // Supports {{variables}}
  headers?: Record<string, string>;
  body?: string; // Template with {{variables}}
  responseMapping?: ResponseMapping[];

  // Code config (when executionType == "code")
  code?: string; // JavaScript code
  inputVariables?: string[];
  outputVariable?: string;

  // Common settings
  timeout?: number;
  speakDuringExecution?: ContentConfig; // Optional speech while running
  waitForResult?: boolean; // Pause until function completes
  transitions: TransitionCondition[];
}

export interface ResponseMapping {
  id: string;
  variable: string;
  path: string; // JSONPath expression
}

// --- Call Transfer Node ---
// Routes call to another phone number. Agent stays silent.
// Only works during phone calls.
export interface CallTransferConfig {
  destination: string; // Phone number (e.164) or {{variable}}
  transferType: "cold" | "warm";
  // Warm transfer options
  warmOptions?: {
    holdMusic?: boolean;
    humanDetectionTimeout?: number; // seconds
  };
}

// --- Set Variable Node ---
// Sets/extracts variables. Agent stays silent. Auto-advances.
export interface SetVariableConfig {
  assignments: VariableAssignment[];
}

export interface VariableAssignment {
  id: string;
  variable: string;
  value: string; // Can be template: "{{user_name}}" or literal value
  operation: "set" | "append" | "increment" | "decrement";
}

// --- End Node ---
// Terminates call immediately. Optionally speaks farewell.
export interface EndConfig {
  speakDuringExecution?: ContentConfig; // Optional farewell message
  reason?: string; // Why the call ended
}

// ============================================
// Union Type for All Node Configs
// ============================================

export type NodeConfig =
  | StartConfig
  | ConversationConfig
  | FunctionConfig
  | CallTransferConfig
  | SetVariableConfig
  | EndConfig;

// ============================================
// Flow Node Types
// ============================================

export interface FlowNodeData extends BaseNodeData {
  config: NodeConfig;
  [key: string]: unknown;
}

export interface FlowNode extends Node<FlowNodeData> {
  type: NodeType;
}

export interface FlowEdge extends Edge {
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

// ============================================
// Flow Metadata & Structure
// ============================================

export interface FlowSettings {
  defaultVoice: string;
  language: string;
  timeout: number;
  maxTurns?: number;
  recordCalls?: boolean;
  transcribeCalls?: boolean;
  // Global prompt (persona, guardrails - available in every node)
  globalPrompt?: string;
}

export interface FlowMetadata {
  id: string;
  name: string;
  description?: string;
  variables: FlowVariable[];
  settings: FlowSettings;
}

export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: FlowVariable[];
  settings: FlowSettings;
}

export interface Flow {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  status: "draft" | "published";
  flowData: FlowData;
  nodeCount: number;
  createdAt: Date;
  updatedAt: Date;
  // Production endpoint fields
  webhookId?: string;
  webhookSecret?: string;
  deployedVersion?: number;
  endpointEnabled?: boolean;
}

export interface FlowVersion {
  id: string;
  flowId: string;
  versionNumber: number;
  flowData: FlowData;
  publishedAt: Date;
  publishedBy: string;
}

// ============================================
// Validation Types
// ============================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  nodeId?: string;
  field?: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  nodeId?: string;
  message: string;
  code: string;
}

// ============================================
// Template Types
// ============================================

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: FlowVariable[];
  settings: FlowSettings;
}

// ============================================
// Execution Types (for test mode)
// ============================================

export interface ExecutionState {
  currentNodeId: string;
  variables: Record<string, unknown>;
  messages: ExecutionMessage[];
  status: "running" | "completed" | "error" | "waiting_input";
  error?: string;
}

export interface ExecutionMessage {
  id: string;
  role: "agent" | "user" | "system";
  text: string;
  timestamp: Date;
  nodeId?: string;
}

export interface ExecutionResult {
  output?: string;
  nextNodeId: string | null;
  variableUpdates: Record<string, unknown>;
  action?: string;
  error?: string;
}

// ============================================
// Store Types
// ============================================

export interface FlowSnapshot {
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: FlowVariable[];
  timestamp: Date;
}

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}
