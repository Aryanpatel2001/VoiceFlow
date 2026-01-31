/**
 * Node Components Registry
 *
 * Maps the 6 node types to their React components for React Flow.
 * Node types: start, conversation, function, call_transfer, set_variable, end
 *
 * @module components/canvas/nodes
 */

import type { NodeTypes } from "@xyflow/react";
import { StartNode } from "./start-node";
import { ConversationNode } from "./conversation-node";
import { FunctionNode } from "./function-node";
import { CallTransferNode } from "./call-transfer-node";
import { SetVariableNode } from "./set-variable-node";
import { EndNode } from "./end-node";

export const nodeTypes: NodeTypes = {
  start: StartNode,
  conversation: ConversationNode,
  function: FunctionNode,
  call_transfer: CallTransferNode,
  set_variable: SetVariableNode,
  end: EndNode,
};

export {
  StartNode,
  ConversationNode,
  FunctionNode,
  CallTransferNode,
  SetVariableNode,
  EndNode,
};
