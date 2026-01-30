/**
 * Function Node Component
 *
 * Executes custom JavaScript code in a sandbox.
 */

"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Code } from "lucide-react";
import { BaseNode } from "./base-node";
import type { FlowNode, FunctionConfig } from "@/lib/canvas/types";

function FunctionNodeComponent({ id, data, selected }: NodeProps<FlowNode>) {
  const config = data.config as FunctionConfig;

  // Get first non-comment, non-empty line of code
  const codePreview = config.code
    ?.split("\n")
    .filter((line) => line.trim() && !line.trim().startsWith("//"))
    .slice(0, 2)
    .join("\n")
    .slice(0, 50);

  return (
    <BaseNode
      id={id}
      label={data.label}
      icon={Code}
      color="text-slate-600"
      bgColor="bg-slate-50 dark:bg-slate-950"
      selected={selected}
      errors={data.validationErrors}
    >
      {/* Code Preview */}
      <pre className="text-[10px] font-mono bg-muted/50 rounded p-1.5 overflow-hidden">
        <code className="line-clamp-2">
          {codePreview || "// No code"}
          {(config.code?.length || 0) > 50 && "..."}
        </code>
      </pre>

      {/* Input/Output */}
      <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground/70">
        {config.inputVariables && config.inputVariables.length > 0 && (
          <span>
            In: {config.inputVariables.slice(0, 2).join(", ")}
            {config.inputVariables.length > 2 && "..."}
          </span>
        )}
        {config.outputVariable && <span>→ {config.outputVariable}</span>}
      </div>

      {/* Timeout */}
      {config.timeout && (
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
          Timeout: {config.timeout}ms
        </p>
      )}
    </BaseNode>
  );
}

export const FunctionNode = memo(FunctionNodeComponent);
