/**
 * Version Diff Component
 *
 * Shows differences between two flow versions.
 */

"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  GitCompare,
  Plus,
  Minus,
  Edit3,
  X,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FlowNode {
  id: string;
  type: string;
  data: {
    label: string;
    config?: unknown;
  };
  position: { x: number; y: number };
}

interface FlowVersion {
  id: string;
  versionNumber: number;
  flowData: {
    nodes: FlowNode[];
    edges: unknown[];
    variables: unknown[];
    settings: unknown;
  };
  publishedAt: string;
}

interface VersionDiffProps {
  oldVersion: FlowVersion;
  newVersion: FlowVersion;
  isOpen: boolean;
  onClose: () => void;
}

interface DiffItem {
  type: "added" | "removed" | "modified";
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  details?: string;
}

export function VersionDiff({
  oldVersion,
  newVersion,
  isOpen,
  onClose,
}: VersionDiffProps) {
  const diff = useMemo(() => {
    const oldNodes = new Map<string, FlowNode>();
    const newNodes = new Map<string, FlowNode>();

    // Index old nodes
    for (const node of oldVersion.flowData.nodes || []) {
      oldNodes.set(node.id, node);
    }

    // Index new nodes
    for (const node of newVersion.flowData.nodes || []) {
      newNodes.set(node.id, node);
    }

    const items: DiffItem[] = [];

    // Find added and modified nodes
    Array.from(newNodes.entries()).forEach(([id, newNode]) => {
      const oldNode = oldNodes.get(id);

      if (!oldNode) {
        items.push({
          type: "added",
          nodeId: id,
          nodeLabel: newNode.data?.label || "Unnamed",
          nodeType: newNode.type,
        });
      } else {
        // Check for modifications
        const oldConfig = JSON.stringify(oldNode.data?.config);
        const newConfig = JSON.stringify(newNode.data?.config);

        if (oldConfig !== newConfig || oldNode.data?.label !== newNode.data?.label) {
          items.push({
            type: "modified",
            nodeId: id,
            nodeLabel: newNode.data?.label || "Unnamed",
            nodeType: newNode.type,
            details: oldNode.data?.label !== newNode.data?.label
              ? `Label: "${oldNode.data?.label}" → "${newNode.data?.label}"`
              : "Configuration changed",
          });
        }
      }
    });

    // Find removed nodes
    Array.from(oldNodes.entries()).forEach(([id, oldNode]) => {
      if (!newNodes.has(id)) {
        items.push({
          type: "removed",
          nodeId: id,
          nodeLabel: oldNode.data?.label || "Unnamed",
          nodeType: oldNode.type,
        });
      }
    });

    // Sort: added first, then modified, then removed
    items.sort((a, b) => {
      const order = { added: 0, modified: 1, removed: 2 };
      return order[a.type] - order[b.type];
    });

    return {
      items,
      summary: {
        added: items.filter((i) => i.type === "added").length,
        modified: items.filter((i) => i.type === "modified").length,
        removed: items.filter((i) => i.type === "removed").length,
      },
    };
  }, [oldVersion, newVersion]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-2xl mx-4 bg-card rounded-xl shadow-xl border border-border max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <GitCompare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Version Comparison</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>v{oldVersion.versionNumber}</span>
                <ArrowRight className="h-3 w-3" />
                <span>v{newVersion.versionNumber}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="flex items-center gap-4 border-b border-border p-4 bg-muted/50">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success/20">
              <Plus className="h-3 w-3 text-success" />
            </div>
            <span className="text-sm">
              <span className="font-medium">{diff.summary.added}</span> added
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-warning/20">
              <Edit3 className="h-3 w-3 text-warning" />
            </div>
            <span className="text-sm">
              <span className="font-medium">{diff.summary.modified}</span> modified
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/20">
              <Minus className="h-3 w-3 text-destructive" />
            </div>
            <span className="text-sm">
              <span className="font-medium">{diff.summary.removed}</span> removed
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {diff.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <GitCompare className="h-8 w-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                No differences found
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {diff.items.map((item, index) => (
                <motion.div
                  key={item.nodeId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3",
                    item.type === "added" && "border-success/30 bg-success/5",
                    item.type === "modified" && "border-warning/30 bg-warning/5",
                    item.type === "removed" && "border-destructive/30 bg-destructive/5"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full shrink-0",
                      item.type === "added" && "bg-success/20",
                      item.type === "modified" && "bg-warning/20",
                      item.type === "removed" && "bg-destructive/20"
                    )}
                  >
                    {item.type === "added" && <Plus className="h-3 w-3 text-success" />}
                    {item.type === "modified" && <Edit3 className="h-3 w-3 text-warning" />}
                    {item.type === "removed" && <Minus className="h-3 w-3 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {item.nodeLabel}
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {item.nodeType}
                      </span>
                    </div>
                    {item.details && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.details}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground/70 font-mono">
                      {item.nodeId}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
