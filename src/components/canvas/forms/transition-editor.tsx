"use client";

import { useCallback } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import type { TransitionCondition, TransitionType } from "@/lib/canvas/types";

interface TransitionEditorProps {
  transitions: TransitionCondition[];
  onChange: (transitions: TransitionCondition[]) => void;
}

export function TransitionEditor({ transitions, onChange }: TransitionEditorProps) {
  const addTransition = useCallback(
    (type: TransitionType) => {
      const id = `t_${Date.now()}`;
      const newTransition: TransitionCondition = {
        id,
        type,
        condition: "",
        handle: id,
        label: "",
      };
      onChange([...transitions, newTransition]);
    },
    [transitions, onChange]
  );

  const removeTransition = useCallback(
    (id: string) => {
      onChange(transitions.filter((t) => t.id !== id));
    },
    [transitions, onChange]
  );

  const updateTransition = useCallback(
    (id: string, updates: Partial<TransitionCondition>) => {
      onChange(
        transitions.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
    },
    [transitions, onChange]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-foreground">Transitions</label>
      </div>

      {transitions.length === 0 && (
        <p className="text-xs text-muted-foreground/70 italic py-2">
          No transitions — node will loop on itself.
        </p>
      )}

      <div className="space-y-2">
        {transitions.map((transition, index) => (
          <div
            key={transition.id}
            className="border border-border rounded-md overflow-hidden"
          >
            {/* Transition header */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/30">
              <GripVertical className="h-3 w-3 text-muted-foreground/50 shrink-0" />

              {/* Type badge */}
              {transition.type === "equation" ? (
                <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-100 text-amber-700 text-[10px] font-bold dark:bg-amber-900 dark:text-amber-300 shrink-0">
                  &Sigma;
                </span>
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded bg-violet-100 text-violet-700 text-[10px] dark:bg-violet-900 dark:text-violet-300 shrink-0">
                  &#10022;
                </span>
              )}

              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex-1">
                {transition.type === "equation" ? "Equation" : "AI Prompt"} #{index + 1}
              </span>

              <button
                onClick={() => removeTransition(transition.id)}
                className="p-0.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>

            {/* Transition body */}
            <div className="px-2 py-2 space-y-2">
              {/* Label */}
              <input
                value={transition.label || ""}
                onChange={(e) =>
                  updateTransition(transition.id, { label: e.target.value })
                }
                placeholder="Label (shown on handle)"
                className="w-full px-2 py-1 text-xs bg-background border border-border rounded outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
              />

              {/* Condition */}
              {transition.type === "equation" ? (
                <input
                  value={transition.condition}
                  onChange={(e) =>
                    updateTransition(transition.id, { condition: e.target.value })
                  }
                  placeholder='e.g. {{intent}} == "booking"'
                  className="w-full px-2 py-1 text-xs font-mono bg-background border border-border rounded outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                />
              ) : (
                <textarea
                  value={transition.condition}
                  onChange={(e) =>
                    updateTransition(transition.id, { condition: e.target.value })
                  }
                  placeholder="Describe when this path should be taken, e.g. 'User wants to book an appointment'"
                  rows={2}
                  className="w-full px-2 py-1 text-xs bg-background border border-border rounded resize-none outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => addTransition("equation")}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-dashed border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950"
        >
          <Plus className="h-3 w-3" />
          <span className="font-bold">&Sigma;</span> Equation
        </button>
        <button
          onClick={() => addTransition("prompt")}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-dashed border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-950"
        >
          <Plus className="h-3 w-3" />
          <span>&#10022;</span> AI Prompt
        </button>
      </div>

      {/* Help text */}
      <div className="text-[10px] text-muted-foreground/60 space-y-0.5 pt-1">
        <p><strong>&Sigma; Equation</strong> — Evaluated first, top-to-bottom. Variable-based.</p>
        <p><strong>&#10022; AI Prompt</strong> — Evaluated after. AI decides if condition is met.</p>
        <p>First TRUE transition wins. If none match, node loops.</p>
      </div>
    </div>
  );
}
