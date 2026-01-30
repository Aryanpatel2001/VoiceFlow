/**
 * Node Palette
 *
 * Left sidebar with draggable node types.
 * Nodes are grouped by category (Core, Logic, Integrations).
 *
 * @module components/canvas/node-palette
 */

"use client";

import { NODE_CATEGORIES, NODE_METADATA } from "@/lib/canvas/node-configs";
import type { NodeType } from "@/lib/canvas/types";
import { cn } from "@/lib/utils";

interface PaletteNodeProps {
  type: NodeType;
}

function PaletteNode({ type }: PaletteNodeProps) {
  const meta = NODE_METADATA[type];
  const Icon = meta.icon;

  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData("application/voiceflow-node", type);
    event.dataTransfer.effectAllowed = "move";
  };

  // Don't allow dragging a second start node
  const isStart = type === "start";

  return (
    <div
      draggable={!isStart}
      onDragStart={onDragStart}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-md border border-border bg-card",
        "transition-all cursor-grab active:cursor-grabbing",
        isStart
          ? "opacity-50 cursor-not-allowed"
          : "hover:border-primary/50 hover:shadow-sm hover:bg-accent/50"
      )}
    >
      <div className={cn("p-1.5 rounded", meta.bgColor)}>
        <Icon className={cn("h-4 w-4", meta.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{meta.label}</p>
        <p className="text-[11px] text-muted-foreground truncate">{meta.description}</p>
      </div>
    </div>
  );
}

export function NodePalette() {
  return (
    <div className="w-64 bg-card border-r border-border flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Nodes</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Drag to canvas</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {NODE_CATEGORIES.map((category) => (
          <div key={category.name}>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
              {category.name}
            </h3>
            <div className="space-y-1.5">
              {category.nodes.map((nodeType) => (
                <PaletteNode key={nodeType} type={nodeType} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
