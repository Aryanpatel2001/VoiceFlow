"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { PhoneForwarded } from "lucide-react";
import { BaseNode } from "./base-node";
import { cn } from "@/lib/utils";
import type { FlowNode, CallTransferConfig } from "@/lib/canvas/types";

function CallTransferNodeComponent({ id, data, selected }: NodeProps<FlowNode>) {
  const config = data.config as CallTransferConfig;

  return (
    <BaseNode
      id={id}
      label={data.label}
      icon={PhoneForwarded}
      color="text-yellow-600"
      bgColor="bg-yellow-50 dark:bg-yellow-950"
      selected={selected}
      hasInputHandle={true}
      hasOutputHandle={true}
      outputHandles={[{ id: "transfer_failed", label: "Transfer Failed" }]}
      errors={data.validationErrors}
    >
      {/* Transfer type badge */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-xs font-medium",
            config.transferType === "warm"
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          )}
        >
          {config.transferType === "warm" ? "Warm Transfer" : "Cold Transfer"}
        </span>
      </div>

      {/* Destination */}
      {config.destination ? (
        <p className="text-xs font-mono text-muted-foreground truncate">
          {config.destination}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground/70 italic">
          No destination configured
        </p>
      )}
    </BaseNode>
  );
}

export const CallTransferNode = memo(CallTransferNodeComponent);
