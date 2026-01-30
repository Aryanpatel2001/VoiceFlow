/**
 * Node Components Registry
 *
 * Maps node types to their React components for React Flow.
 * This registry is consumed by the canvas to render the correct
 * component for each node type.
 *
 * @module components/canvas/nodes
 */

import type { NodeTypes } from "@xyflow/react";
import { StartNode } from "./start-node";
import { AIAgentNode } from "./ai-agent-node";
import { ConditionNode } from "./condition-node";
import { SetVariableNode } from "./set-variable-node";
import { APICallNode } from "./api-call-node";
import { TransferNode } from "./transfer-node";
import { EndCallNode } from "./end-call-node";
import { KnowledgeBaseNode } from "./knowledge-base-node";
import { FunctionNode } from "./function-node";

export const nodeTypes: NodeTypes = {
  start: StartNode,
  ai_agent: AIAgentNode,
  condition: ConditionNode,
  set_variable: SetVariableNode,
  api_call: APICallNode,
  transfer: TransferNode,
  end_call: EndCallNode,
  knowledge_base: KnowledgeBaseNode,
  function: FunctionNode,
};

export {
  StartNode,
  AIAgentNode,
  ConditionNode,
  SetVariableNode,
  APICallNode,
  TransferNode,
  EndCallNode,
  KnowledgeBaseNode,
  FunctionNode,
};
