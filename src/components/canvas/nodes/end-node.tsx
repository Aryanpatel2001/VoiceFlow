"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Square } from "lucide-react";
import { BaseNode } from "./base-node";
import type { FlowNode, EndConfig } from "@/lib/canvas/types";

function EndNodeComponent({ id, data, selected }: NodeProps<FlowNode>) {
  const config = data.config as EndConfig;
  const speak = config.speakDuringExecution;

  return (
    <BaseNode
      id={id}
      label={data.label}
      icon={Square}
      color="text-red-600"
      bgColor="bg-red-50 dark:bg-red-950"
      selected={selected}
      hasInputHandle={true}
      hasOutputHandle={false}
      errors={data.validationErrors}
    >
      {/* Farewell message */}
      {speak?.content ? (
        <>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300 mb-1 inline-block">
            {speak.mode === "prompt" ? "Prompt" : "Static"}
          </span>
          <p className="text-xs text-muted-foreground line-clamp-2 italic">
            &ldquo;{speak.content}&rdquo;
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground/70 italic">
          Ends call silently
        </p>
      )}

      {/* Reason */}
      {config.reason && (
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          Reason: {config.reason}
        </p>
      )}
    </BaseNode>
  );
}

export const EndNode = memo(EndNodeComponent);
