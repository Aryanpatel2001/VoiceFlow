/**
 * Transfer Node Component
 *
 * Transfers call to human agent, phone number, or department.
 * Terminal node - no output handle.
 */

"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { PhoneForwarded, User, Phone, Building2 } from "lucide-react";
import { BaseNode } from "./base-node";
import type { FlowNode, TransferConfig } from "@/lib/canvas/types";

function TransferNodeComponent({ id, data, selected }: NodeProps<FlowNode>) {
  const config = data.config as TransferConfig;

  const typeIcons = {
    phone: Phone,
    agent: User,
    department: Building2,
  };

  const TypeIcon = typeIcons[config.type] || Phone;

  return (
    <BaseNode
      id={id}
      label={data.label}
      icon={PhoneForwarded}
      color="text-yellow-600"
      bgColor="bg-yellow-50 dark:bg-yellow-950"
      selected={selected}
      hasOutputHandle={false}
      errors={data.validationErrors}
    >
      {/* Transfer Type */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <TypeIcon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] capitalize text-muted-foreground">
          {config.type}
        </span>
        {config.warmTransfer && (
          <span className="text-[10px] px-1 bg-amber-100 text-amber-700 rounded dark:bg-amber-900 dark:text-amber-300">
            warm
          </span>
        )}
      </div>

      {/* Destination */}
      <p className="text-[10px] font-mono truncate">
        {config.destination || "Not configured"}
      </p>

      {/* Message Preview */}
      {config.message && (
        <p className="text-[10px] text-muted-foreground/70 mt-1 line-clamp-1 italic">
          &ldquo;{config.message}&rdquo;
        </p>
      )}
    </BaseNode>
  );
}

export const TransferNode = memo(TransferNodeComponent);
