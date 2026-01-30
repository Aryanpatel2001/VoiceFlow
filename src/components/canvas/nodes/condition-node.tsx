/**
 * Condition Node Component
 *
 * Multi-branch logic node based on variable values or sentiment.
 * Supports multiple output handles for different branches.
 */

"use client";

import { memo, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import { BaseNode } from "./base-node";
import type { FlowNode, ConditionConfig } from "@/lib/canvas/types";

function ConditionNodeComponent({ id, data, selected }: NodeProps<FlowNode>) {
  const config = data.config as ConditionConfig;

  const outputHandles = useMemo(() => {
    const handles: Array<{ id: string; label: string; position: number }> = [];

    // Add handles for each rule
    if (config.rules) {
      const uniqueHandles = new Set<string>();
      config.rules.forEach((rule) => {
        if (rule.outputHandle && !uniqueHandles.has(rule.outputHandle)) {
          uniqueHandles.add(rule.outputHandle);
        }
      });

      const handleList = Array.from(uniqueHandles);
      handleList.forEach((handle, index) => {
        handles.push({
          id: handle,
          label: handle,
          position: (index + 1) / (handleList.length + 2),
        });
      });
    }

    // Add default handle
    const defaultHandle = config.defaultHandle || "false";
    handles.push({
      id: defaultHandle,
      label: "else",
      position: (handles.length + 1) / (handles.length + 2),
    });

    return handles;
  }, [config.rules, config.defaultHandle]);

  return (
    <BaseNode
      id={id}
      label={data.label}
      icon={GitBranch}
      color="text-orange-600"
      bgColor="bg-orange-50 dark:bg-orange-950"
      selected={selected}
      hasOutputHandle={false}
      outputHandles={outputHandles}
      errors={data.validationErrors}
    >
      {/* Rules Summary */}
      <div className="space-y-1">
        {config.rules?.slice(0, 3).map((rule, index) => (
          <div key={rule.id || index} className="flex items-center gap-1">
            <span className="text-[10px] font-mono bg-muted px-1 rounded">
              {rule.variable || "?"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatOperator(rule.operator)}
            </span>
            <span className="text-[10px] font-mono bg-muted px-1 rounded truncate max-w-[60px]">
              {String(rule.value || "?")}
            </span>
          </div>
        ))}
        {config.rules && config.rules.length > 3 && (
          <p className="text-[10px] text-muted-foreground/70">
            +{config.rules.length - 3} more rules
          </p>
        )}
      </div>
    </BaseNode>
  );
}

function formatOperator(op: string): string {
  const operators: Record<string, string> = {
    equals: "=",
    not_equals: "!=",
    contains: "has",
    not_contains: "!has",
    greater_than: ">",
    less_than: "<",
    greater_or_equal: ">=",
    less_or_equal: "<=",
    is_empty: "empty",
    is_not_empty: "!empty",
    matches_regex: "~",
    sentiment_positive: "+",
    sentiment_negative: "-",
    sentiment_neutral: "~",
  };
  return operators[op] || op;
}

export const ConditionNode = memo(ConditionNodeComponent);
