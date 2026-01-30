/**
 * Condition Form
 *
 * Configuration form for Condition nodes.
 * Manage branching rules with variables and operators.
 *
 * @module components/canvas/forms/condition-form
 */

"use client";

import { useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ConditionConfig, ConditionRule, ConditionOperator, FlowVariable } from "@/lib/canvas/types";
import { CONDITION_OPERATORS } from "@/lib/canvas/node-configs";

interface ConditionFormProps {
  config: ConditionConfig;
  onChange: (config: ConditionConfig) => void;
  variables: FlowVariable[];
}

export function ConditionForm({ config, onChange, variables }: ConditionFormProps) {
  const addRule = useCallback(() => {
    const rules: ConditionRule[] = [
      ...config.rules,
      {
        id: `rule_${Date.now()}`,
        variable: "",
        operator: "equals",
        value: "",
        outputHandle: `branch_${config.rules.length + 1}`,
      },
    ];
    onChange({ ...config, rules });
  }, [config, onChange]);

  const removeRule = useCallback(
    (id: string) => {
      const rules = config.rules.filter((r) => r.id !== id);
      onChange({ ...config, rules });
    },
    [config, onChange]
  );

  const updateRule = useCallback(
    (id: string, updates: Partial<ConditionRule>) => {
      const rules = config.rules.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      );
      onChange({ ...config, rules });
    },
    [config, onChange]
  );

  return (
    <div className="space-y-4">
      {/* Rules */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-foreground">Rules</label>
          <button
            onClick={addRule}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Add Rule
          </button>
        </div>

        <div className="space-y-3">
          {config.rules.map((rule, index) => (
            <div key={rule.id} className="border border-border rounded-md p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Rule {index + 1}
                </span>
                {config.rules.length > 1 && (
                  <button
                    onClick={() => removeRule(rule.id)}
                    className="p-0.5 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Variable */}
              <select
                value={rule.variable}
                onChange={(e) => updateRule(rule.id, { variable: e.target.value })}
                className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
              >
                <option value="">Select variable...</option>
                {variables.map((v) => (
                  <option key={v.id} value={v.name}>
                    {v.name}
                  </option>
                ))}
                <option value="user_input">user_input</option>
                <option value="intent">intent</option>
                <option value="sentiment">sentiment</option>
              </select>

              {/* Operator */}
              <select
                value={rule.operator}
                onChange={(e) =>
                  updateRule(rule.id, { operator: e.target.value as ConditionOperator })
                }
                className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
              >
                {CONDITION_OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>

              {/* Value */}
              {!["is_empty", "is_not_empty", "sentiment_positive", "sentiment_negative", "sentiment_neutral"].includes(
                rule.operator
              ) && (
                <input
                  value={String(rule.value || "")}
                  onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                  placeholder="Value..."
                  className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                />
              )}

              {/* Output Handle */}
              <input
                value={rule.outputHandle}
                onChange={(e) => updateRule(rule.id, { outputHandle: e.target.value })}
                placeholder="Output handle name"
                className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Default Handle */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">
          Default Branch (when no rules match)
        </label>
        <input
          value={config.defaultHandle}
          onChange={(e) => onChange({ ...config, defaultHandle: e.target.value })}
          placeholder="false"
          className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}
