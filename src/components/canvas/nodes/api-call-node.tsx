/**
 * API Call Node Component
 *
 * Makes HTTP requests to external services.
 * Has success and error output handles.
 */

"use client";

import { memo, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Globe } from "lucide-react";
import { BaseNode } from "./base-node";
import type { FlowNode, APICallConfig } from "@/lib/canvas/types";
import { cn } from "@/lib/utils";

function APICallNodeComponent({ id, data, selected }: NodeProps<FlowNode>) {
  const config = data.config as APICallConfig;

  const outputHandles = useMemo(
    () => [
      { id: "success", label: "success", position: 0.33 },
      { id: config.errorHandle || "error", label: "error", position: 0.67 },
    ],
    [config.errorHandle]
  );

  const methodColors: Record<string, string> = {
    GET: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    POST: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    PUT: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    PATCH: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    DELETE: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };

  // Extract hostname from URL
  let hostname = "";
  try {
    const urlWithoutVars = config.url?.replace(/\{\{[^}]+\}\}/g, "placeholder") || "";
    if (urlWithoutVars) {
      hostname = new URL(urlWithoutVars).hostname;
    }
  } catch {
    hostname = config.url?.slice(0, 30) || "No URL";
  }

  return (
    <BaseNode
      id={id}
      label={data.label}
      icon={Globe}
      color="text-cyan-600"
      bgColor="bg-cyan-50 dark:bg-cyan-950"
      selected={selected}
      hasOutputHandle={false}
      outputHandles={outputHandles}
      errors={data.validationErrors}
    >
      {/* Method Badge */}
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-medium",
            methodColors[config.method] || methodColors.GET
          )}
        >
          {config.method}
        </span>
      </div>

      {/* URL */}
      <p className="text-[10px] font-mono truncate text-muted-foreground">
        {hostname || "No URL set"}
      </p>

      {/* Response Mapping Count */}
      {config.responseMapping && config.responseMapping.length > 0 && (
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          Maps {config.responseMapping.length} field
          {config.responseMapping.length !== 1 ? "s" : ""}
        </p>
      )}
    </BaseNode>
  );
}

export const APICallNode = memo(APICallNodeComponent);
