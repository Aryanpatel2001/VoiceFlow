/**
 * Start Node Component
 *
 * Entry point of the conversation flow.
 * Shows whether the agent or user speaks first,
 * the content mode (Prompt vs Static), and a greeting preview.
 *
 * Output: single "default" handle at the bottom.
 *
 * @module components/canvas/nodes/start-node
 */

"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Play, User, Bot } from "lucide-react";
import { BaseNode } from "./base-node";
import { cn } from "@/lib/utils";
import type { FlowNode, StartConfig } from "@/lib/canvas/types";

function StartNodeComponent({ id, data, selected }: NodeProps<FlowNode>) {
  const config = data.config as StartConfig;

  const speaksFirst = config.speaksFirst ?? true;
  const greeting = config.greeting;
  const mode = greeting?.mode ?? "static";
  const content = greeting?.content ?? "";

  return (
    <BaseNode
      id={id}
      label={data.label}
      icon={Play}
      color="text-green-600"
      bgColor="bg-green-50 dark:bg-green-950"
      selected={selected}
      hasInputHandle={false}
      hasOutputHandle={true}
      errors={data.validationErrors}
    >
      {/* Agent First / User First indicator */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium",
            speaksFirst
              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          )}
        >
          {speaksFirst ? (
            <>
              <Bot className="h-3 w-3" />
              Agent First
            </>
          ) : (
            <>
              <User className="h-3 w-3" />
              User First
            </>
          )}
        </div>

        {/* Mode badge (only shown if agent speaks first) */}
        {speaksFirst && greeting && (
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-xs font-medium",
              mode === "prompt"
                ? "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            )}
          >
            {mode === "prompt" ? "Prompt" : "Static"}
          </span>
        )}
      </div>

      {/* Greeting content preview */}
      {speaksFirst && content ? (
        <p className="text-xs text-muted-foreground line-clamp-2 italic">
          &ldquo;{content}&rdquo;
        </p>
      ) : !speaksFirst ? (
        <p className="text-xs text-muted-foreground/70 italic">
          Waiting for user to speak first...
        </p>
      ) : (
        <p className="text-xs text-muted-foreground/70 italic">
          No greeting configured
        </p>
      )}
    </BaseNode>
  );
}

export const StartNode = memo(StartNodeComponent);
