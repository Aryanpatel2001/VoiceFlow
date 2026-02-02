"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Code, Globe, Volume2, Clock } from "lucide-react";
import { BaseNode } from "./base-node";
import { cn } from "@/lib/utils";
import type { FlowNode, FunctionConfig } from "@/lib/canvas/types";

function FunctionNodeComponent({ id, data, selected }: NodeProps<FlowNode>) {
  const config = data.config as FunctionConfig;
  const transitions = config.transitions ?? [];
  const isHttp = config.executionType === "http";

  return (
    <BaseNode
      id={id}
      label={data.label}
      icon={Code}
      color="text-cyan-600"
      bgColor="bg-cyan-50 dark:bg-cyan-950"
      selected={selected}
      hasInputHandle={true}
      hasOutputHandle={false}
      transitionHandles={transitions}
      errors={data.validationErrors}
    >
      {/* Badges row */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {/* Execution type badge */}
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-xs font-medium",
            isHttp
              ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300"
              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          )}
        >
          {isHttp ? "HTTP" : "Code"}
        </span>

        {/* HTTP method badge */}
        {isHttp && config.method && (
          <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            {config.method}
          </span>
        )}

        {/* Speak during execution */}
        {config.speakDuringExecution && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
            <Volume2 className="h-3 w-3" />
            Speak
          </span>
        )}

        {/* Wait for result */}
        {config.waitForResult && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
            <Clock className="h-3 w-3" />
            Wait
          </span>
        )}
      </div>

      {/* Content preview */}
      {isHttp ? (
        config.url ? (
          <div className="flex items-center gap-1.5">
            <Globe className="h-3 w-3 text-muted-foreground/70 shrink-0" />
            <p className="text-xs text-muted-foreground truncate">
              {config.url}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/70 italic">No URL configured</p>
        )
      ) : (
        config.code ? (
          <pre className="text-[10px] font-mono bg-muted/50 rounded p-1.5 overflow-hidden">
            <code className="line-clamp-2">
              {config.code
                .split("\n")
                .filter((l) => l.trim() && !l.trim().startsWith("//"))
                .slice(0, 2)
                .join("\n")
                .slice(0, 60) || "// No code"}
            </code>
          </pre>
        ) : (
          <p className="text-xs text-muted-foreground/70 italic">No code configured</p>
        )
      )}

      {/* Response mapping count */}
      {isHttp && config.responseMapping && config.responseMapping.length > 0 && (
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          {config.responseMapping.length} response mapping{config.responseMapping.length > 1 ? "s" : ""}
        </p>
      )}

      {/* Transitions hint */}
      {transitions.length === 0 && (
        <p className="text-[10px] text-muted-foreground/50 mt-2 italic">
          No transitions configured
        </p>
      )}
    </BaseNode>
  );
}

export const FunctionNode = memo(FunctionNodeComponent);
