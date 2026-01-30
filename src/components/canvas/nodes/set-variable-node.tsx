/**
 * Set Variable Node Component
 *
 * Assigns or modifies flow variables.
 */

"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Variable } from "lucide-react";
import { BaseNode } from "./base-node";
import type { FlowNode, SetVariableConfig } from "@/lib/canvas/types";

function SetVariableNodeComponent({ id, data, selected }: NodeProps<FlowNode>) {
  const config = data.config as SetVariableConfig;

  return (
    <BaseNode
      id={id}
      label={data.label}
      icon={Variable}
      color="text-blue-600"
      bgColor="bg-blue-50 dark:bg-blue-950"
      selected={selected}
      errors={data.validationErrors}
    >
      <div className="space-y-1">
        {config.assignments?.slice(0, 3).map((assignment, index) => (
          <div key={assignment.id || index} className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono bg-muted px-1 rounded truncate max-w-[60px]">
              {assignment.variable || "?"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {assignment.operation === "set" && "="}
              {assignment.operation === "append" && "+="}
              {assignment.operation === "increment" && "++"}
              {assignment.operation === "decrement" && "--"}
            </span>
            <span className="text-[10px] font-mono bg-muted px-1 rounded truncate max-w-[60px]">
              {assignment.value || "?"}
            </span>
          </div>
        ))}
        {config.assignments && config.assignments.length > 3 && (
          <p className="text-[10px] text-muted-foreground/70">
            +{config.assignments.length - 3} more
          </p>
        )}
      </div>
    </BaseNode>
  );
}

export const SetVariableNode = memo(SetVariableNodeComponent);
