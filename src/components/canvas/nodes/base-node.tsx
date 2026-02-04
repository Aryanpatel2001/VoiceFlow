/**
 * Base Node Component
 *
 * Shared wrapper component for all canvas node types.
 * Provides consistent styling, handles, error display,
 * and transition condition rendering with output handles.
 *
 * @module components/canvas/nodes/base-node
 */

"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { AlertCircle, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/stores/canvas.store";
import type { TransitionCondition } from "@/lib/canvas/types";

export interface BaseNodeProps {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  selected?: boolean;
  children?: React.ReactNode;
  hasInputHandle?: boolean;
  hasOutputHandle?: boolean;
  outputHandles?: Array<{ id: string; label?: string }>;
  transitionHandles?: TransitionCondition[];
  errors?: string[];
  className?: string;
}

/**
 * Returns the appropriate icon character for a transition type.
 * Equation transitions use the sigma symbol, prompt transitions use a sparkle.
 */
function TransitionTypeIcon({ type }: { type: TransitionCondition["type"] }) {
  if (type === "equation") {
    return (
      <span
        className="flex h-5 w-5 items-center justify-center rounded bg-amber-100 text-amber-700 text-xs font-bold dark:bg-amber-900 dark:text-amber-300"
        title="Equation condition"
      >
        &Sigma;
      </span>
    );
  }

  return (
    <span
      className="flex h-5 w-5 items-center justify-center rounded bg-violet-100 text-violet-700 text-xs dark:bg-violet-900 dark:text-violet-300"
      title="Prompt condition"
    >
      &#10022;
    </span>
  );
}

function BaseNodeComponent({
  id,
  label,
  icon: Icon,
  color,
  bgColor,
  selected,
  children,
  hasInputHandle = true,
  hasOutputHandle = true,
  outputHandles,
  transitionHandles,
  errors,
  className,
}: BaseNodeProps) {
  const deleteNode = useCanvasStore((s) => s.deleteNode);

  const hasErrors = errors && errors.length > 0;
  const hasTransitions = transitionHandles && transitionHandles.length > 0;

  return (
    <div
      className={cn(
        "group relative w-[280px] rounded-lg border bg-card shadow-md transition-all",
        selected
          ? "border-2 shadow-lg ring-2 ring-primary/20"
          : "border-border hover:border-border/80",
        selected && color.includes("green") && "border-green-500",
        selected && color.includes("purple") && "border-purple-500",
        selected && color.includes("cyan") && "border-cyan-500",
        selected && color.includes("yellow") && "border-yellow-500",
        selected && color.includes("blue") && "border-blue-500",
        selected && color.includes("red") && "border-red-500",
        hasErrors && !selected && "border-destructive",
        className
      )}
    >
      {/* Input Handle */}
      {hasInputHandle && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
        />
      )}

      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-t-lg border-b border-border",
          bgColor
        )}
      >
        <div className={cn("flex items-center justify-center rounded p-1", bgColor)}>
          <Icon className={cn("h-4 w-4", color)} />
        </div>
        <span className="text-sm font-medium text-foreground truncate flex-1">
          {label}
        </span>

        {/* Error Badge */}
        {hasErrors && (
          <div className="group/error relative">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <div className="absolute right-0 top-6 z-50 hidden group-hover/error:block">
              <div className="bg-popover border border-border rounded-md shadow-lg p-2 min-w-[200px]">
                <p className="text-xs font-medium text-destructive mb-1">
                  Errors:
                </p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {errors.map((error, i) => (
                    <li key={i}>&bull; {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Delete Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteNode(id);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-opacity"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      </div>

      {/* Content */}
      {children && (
        <div className="px-3 py-2 text-xs text-muted-foreground">{children}</div>
      )}

      {/* Transition Handles Section */}
      {hasTransitions && (
        <div className="border-t border-border">
          <div className="px-3 py-1.5">
            <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider mb-1">
              Transitions
            </p>
          </div>
          <div className="space-y-0">
            {transitionHandles.map((transition) => (
              <div
                key={transition.id}
                className="relative flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 transition-colors"
              >
                <TransitionTypeIcon type={transition.type} />
                <span className="text-xs text-muted-foreground truncate flex-1">
                  {transition.label || transition.condition || "No condition"}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={transition.handle}
                  className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background !right-[-6px]"
                />
              </div>
            ))}
          </div>
          <div className="h-1.5" />
        </div>
      )}

      {/* Single Output Handle (bottom) - only when no transitions */}
      {hasOutputHandle && !hasTransitions && (
        <Handle
          type="source"
          position={Position.Bottom}
          id={outputHandles?.[0]?.id ?? "default"}
          className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
        />
      )}

      {/* Named Output Handles (bottom, when outputHandles provided but no transitions) */}
      {outputHandles && outputHandles.length > 0 && !hasTransitions && outputHandles[0]?.label && (
        <div className="border-t border-border px-3 py-1.5 flex items-center justify-center">
          <span className="text-[10px] text-muted-foreground">
            {outputHandles[0].label}
          </span>
        </div>
      )}
    </div>
  );
}

export const BaseNode = memo(BaseNodeComponent);
