/**
 * Set Variable Form
 *
 * Configuration form for Set Variable nodes.
 * Manage variable assignments with different operations.
 *
 * @module components/canvas/forms/set-variable-form
 */

"use client";

import { useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { SetVariableConfig, VariableAssignment, FlowVariable } from "@/lib/canvas/types";

interface SetVariableFormProps {
  config: SetVariableConfig;
  onChange: (config: SetVariableConfig) => void;
  variables: FlowVariable[];
}

export function SetVariableForm({ config, onChange, variables }: SetVariableFormProps) {
  const addAssignment = useCallback(() => {
    const assignments: VariableAssignment[] = [
      ...config.assignments,
      { id: `assign_${Date.now()}`, variable: "", value: "", operation: "set" },
    ];
    onChange({ ...config, assignments });
  }, [config, onChange]);

  const removeAssignment = useCallback(
    (id: string) => {
      const assignments = config.assignments.filter((a) => a.id !== id);
      onChange({ ...config, assignments });
    },
    [config, onChange]
  );

  const updateAssignment = useCallback(
    (id: string, updates: Partial<VariableAssignment>) => {
      const assignments = config.assignments.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      );
      onChange({ ...config, assignments });
    },
    [config, onChange]
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-foreground">Assignments</label>
          <button
            onClick={addAssignment}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>

        <div className="space-y-2.5">
          {config.assignments.map((assignment) => (
            <div key={assignment.id} className="border border-border rounded-md p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                {/* Variable Select */}
                <select
                  value={assignment.variable}
                  onChange={(e) =>
                    updateAssignment(assignment.id, { variable: e.target.value })
                  }
                  className="flex-1 px-2 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
                >
                  <option value="">Select variable...</option>
                  {variables.map((v) => (
                    <option key={v.id} value={v.name}>
                      {v.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => removeAssignment(assignment.id)}
                  className="ml-2 p-0.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Operation */}
              <select
                value={assignment.operation}
                onChange={(e) =>
                  updateAssignment(assignment.id, {
                    operation: e.target.value as VariableAssignment["operation"],
                  })
                }
                className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
              >
                <option value="set">Set to</option>
                <option value="append">Append</option>
                <option value="increment">Increment by</option>
                <option value="decrement">Decrement by</option>
              </select>

              {/* Value */}
              <input
                value={assignment.value}
                onChange={(e) =>
                  updateAssignment(assignment.id, { value: e.target.value })
                }
                placeholder="Value or {{variable}} template"
                className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
