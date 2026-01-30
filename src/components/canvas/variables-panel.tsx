/**
 * Variables Panel
 *
 * Slide-over panel for managing flow variables.
 * Add, edit, and delete variables used across nodes.
 *
 * @module components/canvas/variables-panel
 */

"use client";

import { useState, useCallback } from "react";
import { X, Plus, Trash2, Edit2, Check } from "lucide-react";
import { useCanvasStore, useVariables } from "@/stores/canvas.store";
import type { VariableType } from "@/lib/canvas/types";
import { cn } from "@/lib/utils";

interface VariablesPanelProps {
  onClose: () => void;
}

const VARIABLE_TYPES: { value: VariableType; label: string }[] = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "array", label: "Array" },
  { value: "object", label: "Object" },
];

export function VariablesPanel({ onClose }: VariablesPanelProps) {
  const variables = useVariables();
  const addVariable = useCanvasStore((s) => s.addVariable);
  const updateVariable = useCanvasStore((s) => s.updateVariable);
  const deleteVariable = useCanvasStore((s) => s.deleteVariable);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newVar, setNewVar] = useState({ name: "", type: "string" as VariableType, defaultValue: "" });
  const [showAdd, setShowAdd] = useState(false);

  const handleAdd = useCallback(() => {
    if (!newVar.name.trim()) return;

    let parsedDefault: unknown = newVar.defaultValue;
    if (newVar.type === "number") parsedDefault = parseFloat(newVar.defaultValue) || 0;
    else if (newVar.type === "boolean") parsedDefault = newVar.defaultValue === "true";

    addVariable({
      name: newVar.name.trim(),
      type: newVar.type,
      defaultValue: parsedDefault || undefined,
    });

    setNewVar({ name: "", type: "string", defaultValue: "" });
    setShowAdd(false);
  }, [newVar, addVariable]);

  return (
    <div className="w-80 bg-card border-l border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Variables</h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-accent">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Variable List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {variables.length === 0 && !showAdd && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No variables defined yet.
          </p>
        )}

        {variables.map((variable) => (
          <div
            key={variable.id}
            className="border border-border rounded-md p-2.5 space-y-1.5"
          >
            {editingId === variable.id ? (
              <div className="space-y-1.5">
                <input
                  defaultValue={variable.name}
                  onBlur={(e) => {
                    updateVariable(variable.id, { name: e.target.value });
                    setEditingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      updateVariable(variable.id, { name: e.currentTarget.value });
                      setEditingId(null);
                    }
                  }}
                  autoFocus
                  className="w-full px-2 py-1 text-xs bg-background border border-border rounded outline-none focus:border-primary text-foreground font-mono"
                />
                <select
                  value={variable.type}
                  onChange={(e) =>
                    updateVariable(variable.id, { type: e.target.value as VariableType })
                  }
                  className="w-full px-2 py-1 text-xs bg-background border border-border rounded outline-none focus:border-primary text-foreground"
                >
                  {VARIABLE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-xs text-primary flex items-center gap-1"
                >
                  <Check className="h-3 w-3" /> Done
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <code className="text-xs font-mono text-foreground truncate">
                    {variable.name}
                  </code>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-medium",
                      variable.type === "string" && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                      variable.type === "number" && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                      variable.type === "boolean" && "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
                      variable.type === "array" && "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
                      variable.type === "object" && "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    )}
                  >
                    {variable.type}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingId(variable.id)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => deleteVariable(variable.id)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            {editingId !== variable.id && variable.defaultValue !== undefined && (
              <p className="text-[11px] text-muted-foreground">
                Default: <code className="font-mono">{String(variable.defaultValue)}</code>
              </p>
            )}
          </div>
        ))}

        {/* Add New Variable */}
        {showAdd && (
          <div className="border border-primary/30 rounded-md p-2.5 space-y-2 bg-primary/5">
            <input
              value={newVar.name}
              onChange={(e) => setNewVar({ ...newVar, name: e.target.value })}
              placeholder="variable_name"
              autoFocus
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-primary text-foreground font-mono placeholder:text-muted-foreground"
            />
            <select
              value={newVar.type}
              onChange={(e) => setNewVar({ ...newVar, type: e.target.value as VariableType })}
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
            >
              {VARIABLE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              value={newVar.defaultValue}
              onChange={(e) => setNewVar({ ...newVar, defaultValue: e.target.value })}
              placeholder="Default value (optional)"
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!newVar.name.trim()}
                className="flex-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAdd(false);
                  setNewVar({ name: "", type: "string", defaultValue: "" });
                }}
                className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Button */}
      {!showAdd && (
        <div className="p-3 border-t border-border">
          <button
            onClick={() => setShowAdd(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium border border-dashed border-border rounded-md text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Variable
          </button>
        </div>
      )}
    </div>
  );
}
