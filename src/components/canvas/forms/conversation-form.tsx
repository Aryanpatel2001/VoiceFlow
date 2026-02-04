"use client";

import { useCallback } from "react";
import type { ConversationConfig, ContentConfig } from "@/lib/canvas/types";
import { LLM_MODELS } from "@/lib/canvas/node-configs";
import { TransitionEditor } from "./transition-editor";

interface ConversationFormProps {
  config: ConversationConfig;
  onChange: (config: ConversationConfig) => void;
}

export function ConversationForm({ config, onChange }: ConversationFormProps) {
  const content = config.content ?? { mode: "prompt", content: "" };
  const mode = content.mode;

  const updateContent = useCallback(
    (updates: Partial<ContentConfig>) => {
      onChange({ ...config, content: { ...content, ...updates } });
    },
    [config, content, onChange]
  );

  return (
    <div className="space-y-5">
      {/* ---- Content Mode Toggle ---- */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">
          Content Mode
        </label>
        <div className="flex rounded-md overflow-hidden border border-border">
          <button
            onClick={() => updateContent({ mode: "prompt" })}
            className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "prompt"
                ? "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300"
                : "bg-background text-muted-foreground hover:bg-muted/50"
            }`}
          >
            Prompt
          </button>
          <button
            onClick={() => updateContent({ mode: "static" })}
            className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "static"
                ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                : "bg-background text-muted-foreground hover:bg-muted/50"
            }`}
          >
            Static
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          {mode === "prompt"
            ? "AI generates a dynamic response based on the prompt."
            : "Agent speaks a fixed sentence, then listens for user response."}
        </p>
      </div>

      {/* ---- Content ---- */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">
          {mode === "prompt" ? "Prompt" : "Sentence"}
        </label>
        <textarea
          value={content.content}
          onChange={(e) => updateContent({ content: e.target.value })}
          rows={mode === "prompt" ? 6 : 3}
          placeholder={
            mode === "prompt"
              ? "You are a helpful assistant. Greet the user and ask how you can help them today..."
              : "Hello, how can I help you today?"
          }
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md resize-none outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* ---- Behavior Options ---- */}
      <div className="space-y-2.5">
        <label className="text-xs font-medium text-foreground block">Behavior</label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.skipResponse ?? false}
            onChange={(e) => onChange({ ...config, skipResponse: e.target.checked })}
            className="rounded border-border"
          />
          <span className="text-xs text-foreground">Skip user response</span>
        </label>
        <p className="text-[10px] text-muted-foreground/60 ml-5 -mt-1">
          Advance immediately without waiting for user input.
        </p>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.blockInterruptions ?? false}
            onChange={(e) =>
              onChange({ ...config, blockInterruptions: e.target.checked })
            }
            className="rounded border-border"
          />
          <span className="text-xs text-foreground">Block interruptions</span>
        </label>
        <p className="text-[10px] text-muted-foreground/60 ml-5 -mt-1">
          Prevent user from interrupting while the agent is speaking.
        </p>
      </div>

      {/* ---- Model Settings ---- */}
      {mode === "prompt" && (
        <div className="space-y-3">
          <label className="text-xs font-medium text-foreground block">
            Model Settings
          </label>

          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">Model</label>
            <select
              value={config.model ?? "gpt-4o-mini"}
              onChange={(e) =>
                onChange({
                  ...config,
                  model: e.target.value as ConversationConfig["model"],
                })
              }
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
            >
              {LLM_MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">
                Temperature
              </label>
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={config.temperature ?? 0.7}
                onChange={(e) =>
                  onChange({ ...config, temperature: parseFloat(e.target.value) })
                }
                className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">
                Max Tokens
              </label>
              <input
                type="number"
                min={50}
                max={4000}
                step={50}
                value={config.maxTokens ?? 300}
                onChange={(e) =>
                  onChange({ ...config, maxTokens: parseInt(e.target.value) })
                }
                className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
              />
            </div>
          </div>
        </div>
      )}

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
