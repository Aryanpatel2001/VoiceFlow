/**
 * AI Agent Node Component
 *
 * Unified conversational AI node supporting structured and freeform modes.
 * Replaces separate greeting/listen/response nodes.
 */

"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Sparkles, MessageSquare, Zap } from "lucide-react";
import { BaseNode } from "./base-node";
import type { FlowNode, AIAgentConfig } from "@/lib/canvas/types";
import { cn } from "@/lib/utils";

function AIAgentNodeComponent({ id, data, selected }: NodeProps<FlowNode>) {
  const config = data.config as AIAgentConfig;
  const isStructured = config.mode === "structured";

  return (
    <BaseNode
      id={id}
      label={data.label}
      icon={Sparkles}
      color="text-purple-600"
      bgColor="bg-purple-50 dark:bg-purple-950"
      selected={selected}
      errors={data.validationErrors}
    >
      {/* Mode Badge */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
            isStructured
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
          )}
        >
          {isStructured ? (
            <>
              <MessageSquare className="h-3 w-3" />
              Structured
            </>
          ) : (
            <>
              <Zap className="h-3 w-3" />
              Freeform
            </>
          )}
        </span>
      </div>

      {/* Prompt Preview */}
      <p className="line-clamp-2 text-muted-foreground">
        {config.prompt?.slice(0, 80)}
        {(config.prompt?.length || 0) > 80 && "..."}
      </p>

      {/* Response Count / Allowed Actions */}
      {isStructured && config.responses && (
        <p className="mt-1 text-[10px] text-muted-foreground/70">
          {config.responses.length} response{config.responses.length !== 1 ? "s" : ""}
        </p>
      )}
      {!isStructured && config.allowedActions && (
        <p className="mt-1 text-[10px] text-muted-foreground/70">
          Actions: {config.allowedActions.join(", ")}
        </p>
      )}
    </BaseNode>
  );
}

export const AIAgentNode = memo(AIAgentNodeComponent);
