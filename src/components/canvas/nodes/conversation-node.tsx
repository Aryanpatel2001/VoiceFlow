/**
 * Conversation Node Component
 *
 * The primary dialogue node. AI-powered conversation with the user.
 * Supports two content modes: "Prompt" (dynamic AI) and "Static" (fixed sentence).
 * Transitions are evaluated when the user finishes speaking.
 *
 * Output: transition handles on the right side (no bottom output).
 *
 * @module components/canvas/nodes/conversation-node
 */

"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { MessageSquare, SkipForward, ShieldAlert } from "lucide-react";
import { BaseNode } from "./base-node";
import { cn } from "@/lib/utils";
import type { FlowNode, ConversationConfig } from "@/lib/canvas/types";

function ConversationNodeComponent({ id, data, selected }: NodeProps<FlowNode>) {
  const config = data.config as ConversationConfig;

  const mode = config.content?.mode ?? "prompt";
  const content = config.content?.content ?? "";
  const transitions = config.transitions ?? [];
  const skipResponse = config.skipResponse ?? false;
  const blockInterruptions = config.blockInterruptions ?? false;

  return (
    <BaseNode
      id={id}
      label={data.label}
      icon={MessageSquare}
      color="text-purple-600"
      bgColor="bg-purple-50 dark:bg-purple-950"
      selected={selected}
      hasInputHandle={true}
      hasOutputHandle={false}
      transitionHandles={transitions}
      errors={data.validationErrors}
    >
      {/* Mode Badge + Feature Badges */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {/* Prompt / Static mode badge */}
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-xs font-medium",
            mode === "prompt"
              ? "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300"
              : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
          )}
        >
          {mode === "prompt" ? "Prompt" : "Static"}
        </span>

        {/* Skip Response badge */}
        {skipResponse && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
            <SkipForward className="h-3 w-3" />
            Skip
          </span>
        )}

        {/* Block Interruptions badge */}
        {blockInterruptions && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
            <ShieldAlert className="h-3 w-3" />
            No Interrupt
          </span>
        )}
      </div>

      {/* Content preview */}
      {content ? (
        <p className="text-xs text-muted-foreground line-clamp-3">
          {mode === "static" ? (
            <span className="italic">&ldquo;{content}&rdquo;</span>
          ) : (
            content
          )}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground/70 italic">
          {mode === "prompt" ? "No prompt configured" : "No sentence configured"}
        </p>
      )}

      {/* Transition count summary (when no transitions are set) */}
      {transitions.length === 0 && (
        <p className="text-[10px] text-muted-foreground/50 mt-2 italic">
          No transitions configured
        </p>
      )}
    </BaseNode>
  );
}

export const ConversationNode = memo(ConversationNodeComponent);
