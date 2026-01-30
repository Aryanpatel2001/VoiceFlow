/**
 * API Call Form
 *
 * Configuration form for API Call nodes.
 * Configure HTTP method, URL, headers, body, and response mapping.
 *
 * @module components/canvas/forms/api-call-form
 */

"use client";

import { useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { APICallConfig, ResponseMapping } from "@/lib/canvas/types";
import { HTTP_METHODS } from "@/lib/canvas/node-configs";
import { cn } from "@/lib/utils";

interface APICallFormProps {
  config: APICallConfig;
  onChange: (config: APICallConfig) => void;
}

export function APICallForm({ config, onChange }: APICallFormProps) {
  const update = useCallback(
    (updates: Partial<APICallConfig>) => {
      onChange({ ...config, ...updates });
    },
    [config, onChange]
  );

  const methodMeta = HTTP_METHODS.find((m) => m.value === config.method);

  const addMapping = useCallback(() => {
    const responseMapping: ResponseMapping[] = [
      ...config.responseMapping,
      { id: `map_${Date.now()}`, variable: "", path: "" },
    ];
    update({ responseMapping });
  }, [config.responseMapping, update]);

  const removeMapping = useCallback(
    (id: string) => {
      const responseMapping = config.responseMapping.filter((m) => m.id !== id);
      update({ responseMapping });
    },
    [config.responseMapping, update]
  );

  const updateMapping = useCallback(
    (id: string, updates: Partial<ResponseMapping>) => {
      const responseMapping = config.responseMapping.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      );
      update({ responseMapping });
    },
    [config.responseMapping, update]
  );

  const updateHeader = useCallback(
    (key: string, value: string) => {
      const headers = { ...(config.headers || {}), [key]: value };
      update({ headers });
    },
    [config.headers, update]
  );

  return (
    <div className="space-y-4">
      {/* Method + URL */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Request</label>
        <div className="flex gap-2">
          <select
            value={config.method}
            onChange={(e) => update({ method: e.target.value as APICallConfig["method"] })}
            className="px-2 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-primary text-foreground font-mono"
          >
            {HTTP_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            value={config.url}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="https://api.example.com/endpoint"
            className="flex-1 px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground font-mono placeholder:text-muted-foreground"
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Use {"{{variable}}"} for dynamic values
        </p>
      </div>

      {/* Headers */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Headers</label>
        <div className="space-y-1.5">
          {Object.entries(config.headers || {}).map(([key, value]) => (
            <div key={key} className="flex gap-1.5">
              <input
                value={key}
                readOnly
                className="w-1/3 px-2 py-1 text-xs bg-muted border border-border rounded outline-none text-foreground font-mono"
              />
              <input
                value={value}
                onChange={(e) => updateHeader(key, e.target.value)}
                className="flex-1 px-2 py-1 text-xs bg-background border border-border rounded outline-none focus:border-primary text-foreground font-mono"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      {methodMeta?.hasBody && (
        <div>
          <label className="text-xs font-medium text-foreground mb-1.5 block">Body (JSON)</label>
          <textarea
            value={config.body || ""}
            onChange={(e) => update({ body: e.target.value })}
            rows={4}
            placeholder='{"key": "{{variable}}"}'
            className="w-full px-3 py-2 text-xs bg-background border border-border rounded-md resize-none outline-none focus:border-primary text-foreground font-mono placeholder:text-muted-foreground"
          />
        </div>
      )}

      {/* Timeout */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Timeout (ms)</label>
        <input
          type="number"
          min={1000}
          max={30000}
          step={1000}
          value={config.timeout ?? 10000}
          onChange={(e) => update({ timeout: parseInt(e.target.value) })}
          className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
        />
      </div>

      {/* Response Mapping */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-foreground">Response Mapping</label>
          <button
            onClick={addMapping}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        <div className="space-y-2">
          {config.responseMapping.map((mapping) => (
            <div key={mapping.id} className="flex gap-1.5 items-center">
              <input
                value={mapping.path}
                onChange={(e) => updateMapping(mapping.id, { path: e.target.value })}
                placeholder="$.data.result"
                className={cn(
                  "flex-1 px-2 py-1 text-xs bg-background border border-border rounded",
                  "outline-none focus:border-primary text-foreground font-mono placeholder:text-muted-foreground"
                )}
              />
              <span className="text-xs text-muted-foreground">→</span>
              <input
                value={mapping.variable}
                onChange={(e) => updateMapping(mapping.id, { variable: e.target.value })}
                placeholder="variable"
                className={cn(
                  "flex-1 px-2 py-1 text-xs bg-background border border-border rounded",
                  "outline-none focus:border-primary text-foreground font-mono placeholder:text-muted-foreground"
                )}
              />
              <button
                onClick={() => removeMapping(mapping.id)}
                className="p-0.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
