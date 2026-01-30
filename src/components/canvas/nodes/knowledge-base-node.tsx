/**
 * Knowledge Base Node Component
 *
 * Searches uploaded documents for answers using RAG.
 * Has found and no_results output handles.
 */

"use client";

import { memo, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Database } from "lucide-react";
import { BaseNode } from "./base-node";
import type { FlowNode, KnowledgeBaseConfig } from "@/lib/canvas/types";

function KnowledgeBaseNodeComponent({ id, data, selected }: NodeProps<FlowNode>) {
  const config = data.config as KnowledgeBaseConfig;

  const outputHandles = useMemo(
    () => [
      { id: "found", label: "found", position: 0.33 },
      { id: config.noResultsHandle || "no_results", label: "none", position: 0.67 },
    ],
    [config.noResultsHandle]
  );

  return (
    <BaseNode
      id={id}
      label={data.label}
      icon={Database}
      color="text-indigo-600"
      bgColor="bg-indigo-50 dark:bg-indigo-950"
      selected={selected}
      hasOutputHandle={false}
      outputHandles={outputHandles}
      errors={data.validationErrors}
    >
      {/* Query Preview */}
      <p className="text-[10px] font-mono truncate mb-1.5">
        {config.query || "No query set"}
      </p>

      {/* Settings */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
        <span>Top {config.topK || 3}</span>
        <span>•</span>
        <span>Min {((config.minScore || 0.7) * 100).toFixed(0)}%</span>
      </div>

      {/* Output Variable */}
      {config.outputVariable && (
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          → {config.outputVariable}
        </p>
      )}
    </BaseNode>
  );
}

export const KnowledgeBaseNode = memo(KnowledgeBaseNodeComponent);
