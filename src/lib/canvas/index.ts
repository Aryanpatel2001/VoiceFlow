/**
 * Canvas Library
 *
 * Core library for the Agent Canvas flow builder.
 * 6 node types: start, conversation, function, call_transfer, set_variable, end
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
  EQUATION_OPERATORS,
  HTTP_METHODS,
  LLM_MODELS,
  DEFAULT_START_CONFIG,
  DEFAULT_CONVERSATION_CONFIG,
  DEFAULT_FUNCTION_CONFIG,
  DEFAULT_SET_VARIABLE_CONFIG,
  DEFAULT_CALL_TRANSFER_CONFIG,
  DEFAULT_END_CONFIG,
} from "./node-configs";

// Validation
export { validateFlow, validateNode, quickValidateNode } from "./validation";

// Templates
export { FLOW_TEMPLATES, getTemplateById, createBlankFlow } from "./templates";

// Execution engine
export { FlowExecutor, createExecutor } from "./execution-engine";
