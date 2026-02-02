"use client";

import { useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { FunctionConfig, ContentConfig, ResponseMapping } from "@/lib/canvas/types";
import { HTTP_METHODS } from "@/lib/canvas/node-configs";
import { TransitionEditor } from "./transition-editor";

interface FunctionFormProps {
  config: FunctionConfig;
  onChange: (config: FunctionConfig) => void;
}

export function FunctionForm({ config, onChange }: FunctionFormProps) {
  const isHttp = config.executionType === "http";
  const hasBody = HTTP_METHODS.find((m) => m.value === config.method)?.hasBody ?? false;

  // --- Header helpers ---
  const headers = config.headers ?? {};
  const headerEntries = Object.entries(headers);

  const addHeader = useCallback(() => {
    onChange({
      ...config,
      headers: { ...headers, "": "" },
    });
  }, [config, headers, onChange]);

  const removeHeader = useCallback(
    (key: string) => {
      const next = { ...headers };
      delete next[key];
      onChange({ ...config, headers: next });
    },
    [config, headers, onChange]
  );

  const updateHeader = useCallback(
    (oldKey: string, newKey: string, value: string) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(headers)) {
        if (k === oldKey) {
          next[newKey] = value;
        } else {
          next[k] = v;
        }
      }
      onChange({ ...config, headers: next });
    },
    [config, headers, onChange]
  );

  // --- Response mapping helpers ---
  const mappings = config.responseMapping ?? [];

  const addMapping = useCallback(() => {
    const id = `rm_${Date.now()}`;
    onChange({
      ...config,
      responseMapping: [...mappings, { id, variable: "", path: "" }],
    });
  }, [config, mappings, onChange]);

  const removeMapping = useCallback(
    (id: string) => {
      onChange({
        ...config,
        responseMapping: mappings.filter((m) => m.id !== id),
      });
    },
    [config, mappings, onChange]
  );

  const updateMapping = useCallback(
    (id: string, updates: Partial<ResponseMapping>) => {
      onChange({
        ...config,
        responseMapping: mappings.map((m) =>
          m.id === id ? { ...m, ...updates } : m
        ),
      });
    },
    [config, mappings, onChange]
  );

  // --- Speak during execution helpers ---
  const speak = config.speakDuringExecution;

  const toggleSpeak = useCallback(
    (enabled: boolean) => {
      onChange({
        ...config,
        speakDuringExecution: enabled
          ? { mode: "static", content: "Let me check that for you..." }
          : undefined,
      });
    },
    [config, onChange]
  );

  const updateSpeak = useCallback(
    (updates: Partial<ContentConfig>) => {
      if (!speak) return;
      onChange({
        ...config,
        speakDuringExecution: { ...speak, ...updates },
      });
    },
    [config, speak, onChange]
  );

  return (
    <div className="space-y-5">
      {/* ---- Execution Type Toggle ---- */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">
          Execution Type
        </label>
        <div className="flex rounded-md overflow-hidden border border-border">
          <button
            onClick={() => onChange({ ...config, executionType: "http" })}
            className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
              isHttp
                ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300"
                : "bg-background text-muted-foreground hover:bg-muted/50"
            }`}
          >
            HTTP Request
          </button>
          <button
            onClick={() => onChange({ ...config, executionType: "code" })}
            className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
              !isHttp
                ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                : "bg-background text-muted-foreground hover:bg-muted/50"
            }`}
          >
            Custom Code
          </button>
        </div>
      </div>

      {/* ---- HTTP Config ---- */}
      {isHttp && (
        <>
          {/* Method + URL */}
          <div className="flex gap-2">
            <select
              value={config.method ?? "GET"}
              onChange={(e) =>
                onChange({
                  ...config,
                  method: e.target.value as FunctionConfig["method"],
                })
              }
              className="w-24 px-2 py-1.5 text-xs font-bold bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
            >
              {HTTP_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <input
              value={config.url ?? ""}
              onChange={(e) => onChange({ ...config, url: e.target.value })}
              placeholder="https://api.example.com/endpoint"
              className="flex-1 px-2 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-primary text-foreground font-mono placeholder:text-muted-foreground"
            />
          </div>

          {/* Headers */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-foreground">Headers</label>
              <button
                onClick={addHeader}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            <div className="space-y-1.5">
              {headerEntries.map(([key, value], idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    value={key}
                    onChange={(e) => updateHeader(key, e.target.value, value)}
                    placeholder="Key"
                    className="flex-1 px-2 py-1 text-xs font-mono bg-background border border-border rounded outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                  />
                  <input
                    value={value}
                    onChange={(e) => updateHeader(key, key, e.target.value)}
                    placeholder="Value"
                    className="flex-1 px-2 py-1 text-xs font-mono bg-background border border-border rounded outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={() => removeHeader(key)}
                    className="p-0.5 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          {hasBody && (
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Request Body
              </label>
              <textarea
                value={config.body ?? ""}
                onChange={(e) => onChange({ ...config, body: e.target.value })}
                rows={5}
                placeholder={'{\n  "key": "{{variable}}"\n}'}
                className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-md resize-none outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                spellCheck={false}
              />
            </div>
          )}

          {/* Response Mapping */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-foreground">
                Response Mapping
              </label>
              <button
                onClick={addMapping}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            {mappings.length === 0 && (
              <p className="text-[10px] text-muted-foreground/60 italic">
                Map JSON response values to flow variables.
              </p>
            )}
            <div className="space-y-1.5">
              {mappings.map((mapping) => (
                <div key={mapping.id} className="flex items-center gap-1.5">
                  <input
                    value={mapping.path}
                    onChange={(e) =>
                      updateMapping(mapping.id, { path: e.target.value })
                    }
                    placeholder="$.data.id"
                    className="flex-1 px-2 py-1 text-xs font-mono bg-background border border-border rounded outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                  />
                  <span className="text-[10px] text-muted-foreground">&rarr;</span>
                  <input
                    value={mapping.variable}
                    onChange={(e) =>
                      updateMapping(mapping.id, { variable: e.target.value })
                    }
                    placeholder="variable"
                    className="w-24 px-2 py-1 text-xs font-mono bg-background border border-border rounded outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={() => removeMapping(mapping.id)}
                    className="p-0.5 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ---- Code Config ---- */}
      {!isHttp && (
        <>
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">Code</label>
            <textarea
              value={config.code ?? ""}
              onChange={(e) => onChange({ ...config, code: e.target.value })}
              rows={10}
              placeholder={`// Access input variables via \`args\`\n// Return value is stored in output variable\nconst result = args.input_var;\nreturn result;`}
              className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-md resize-none outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
              spellCheck={false}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              Input Variables (comma-separated)
            </label>
            <input
              value={(config.inputVariables ?? []).join(", ")}
              onChange={(e) =>
                onChange({
                  ...config,
                  inputVariables: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="var1, var2"
              className="w-full px-2 py-1.5 text-xs font-mono bg-background border border-border rounded-md outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              Output Variable
            </label>
            <input
              value={config.outputVariable ?? ""}
              onChange={(e) =>
                onChange({ ...config, outputVariable: e.target.value })
              }
              placeholder="function_result"
              className="w-full px-2 py-1.5 text-xs font-mono bg-background border border-border rounded-md outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </>
      )}

      {/* ---- Common Settings ---- */}
      <div className="space-y-3 border-t border-border pt-4">
        <label className="text-xs font-medium text-foreground block">Settings</label>

        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">
            Timeout (ms)
          </label>
          <input
            type="number"
            min={1000}
            max={30000}
            step={1000}
            value={config.timeout ?? 10000}
            onChange={(e) =>
              onChange({ ...config, timeout: parseInt(e.target.value) })
            }
            className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.waitForResult ?? true}
            onChange={(e) =>
              onChange({ ...config, waitForResult: e.target.checked })
            }
            className="rounded border-border"
          />
          <span className="text-xs text-foreground">Wait for result</span>
        </label>
        <p className="text-[10px] text-muted-foreground/60 ml-5 -mt-1">
          Pause flow until function completes before moving to next node.
        </p>

        {/* Speak during execution */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!speak}
            onChange={(e) => toggleSpeak(e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-xs text-foreground">Speak during execution</span>
        </label>
        <p className="text-[10px] text-muted-foreground/60 ml-5 -mt-1">
          Agent speaks while the function runs in the background.
        </p>

        {speak && (
          <div className="ml-5 space-y-2">
            <div className="flex rounded-md overflow-hidden border border-border">
              <button
                onClick={() => updateSpeak({ mode: "static" })}
                className={`flex-1 px-2 py-1 text-[10px] font-medium transition-colors ${
                  speak.mode === "static"
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                    : "bg-background text-muted-foreground hover:bg-muted/50"
                }`}
              >
                Static
              </button>
              <button
                onClick={() => updateSpeak({ mode: "prompt" })}
                className={`flex-1 px-2 py-1 text-[10px] font-medium transition-colors ${
                  speak.mode === "prompt"
                    ? "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300"
                    : "bg-background text-muted-foreground hover:bg-muted/50"
                }`}
              >
                Prompt
              </button>
            </div>
            <textarea
              value={speak.content}
              onChange={(e) => updateSpeak({ content: e.target.value })}
              rows={2}
              placeholder={
                speak.mode === "static"
                  ? "Let me check that for you..."
                  : "Generate a brief hold message"
              }
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md resize-none outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>
        )}
      </div>

      {/* ---- Transitions ---- */}
      <div className="border-t border-border pt-4">
        <TransitionEditor
          transitions={config.transitions ?? []}
          onChange={(transitions) => onChange({ ...config, transitions })}
        />
      </div>
    </div>
  );
}
