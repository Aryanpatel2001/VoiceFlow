/**
 * Canvas Library
 *
 * Core library for the Agent Canvas flow builder.
 *
 * @module lib/canvas
 */

// Types
export * from "./types";

// Node configurations
export {
  NODE_METADATA,
  NODE_CATEGORIES,
  getDefaultConfig,
  getOutputHandles,
  CONDITION_OPERATORS,
  HTTP_METHODS,
  TRANSFER_TYPES,
  DEFAULT_START_CONFIG,
  DEFAULT_AI_AGENT_CONFIG,
  DEFAULT_CONDITION_CONFIG,
  DEFAULT_SET_VARIABLE_CONFIG,
  DEFAULT_API_CALL_CONFIG,
  DEFAULT_TRANSFER_CONFIG,
  DEFAULT_END_CALL_CONFIG,
  DEFAULT_KNOWLEDGE_BASE_CONFIG,
  DEFAULT_FUNCTION_CONFIG,
} from "./node-configs";

// Validation
export { validateFlow, validateNode, quickValidateNode } from "./validation";

// Templates
export { FLOW_TEMPLATES, getTemplateById, createBlankFlow } from "./templates";

// Execution engine
export { FlowExecutor, createExecutor } from "./execution-engine";
