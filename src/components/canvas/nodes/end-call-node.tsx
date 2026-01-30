/**
 * End Call Node Component
 *
 * Terminates the call with an optional goodbye message.
 * Terminal node - no output handle.
 */

"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { PhoneOff } from "lucide-react";
import { BaseNode } from "./base-node";
import type { FlowNode, EndCallConfig } from "@/lib/canvas/types";

function EndCallNodeComponent({ id, data, selected }: NodeProps<FlowNode>) {
  const config = data.config as EndCallConfig;

  return (
    <BaseNode
      id={id}
      label={data.label}
      icon={PhoneOff}
      color="text-red-600"
      bgColor="bg-red-50 dark:bg-red-950"
      selected={selected}
      hasOutputHandle={false}
      errors={data.validationErrors}
    >
      {/* Message Preview */}
      {config.message && (
        <p className="text-[10px] line-clamp-2 italic">
          &ldquo;{config.message}&rdquo;
        </p>
      )}

      {/* Reason & Follow-up */}
      <div className="flex items-center gap-2 mt-1">
        {config.reason && (
          <span className="text-[10px] text-muted-foreground/70">
            Reason: {config.reason}
          </span>
        )}
        {config.scheduleFollowUp && (
          <span className="text-[10px] px-1 bg-blue-100 text-blue-700 rounded dark:bg-blue-900 dark:text-blue-300">
            + follow-up
          </span>
        )}
      </div>
    </BaseNode>
  );
}

export const EndCallNode = memo(EndCallNodeComponent);
