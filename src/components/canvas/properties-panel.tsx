"use client";

import { useCallback } from "react";
import { X } from "lucide-react";
import { useCanvasStore, useSelectedNode, useVariables } from "@/stores/canvas.store";
import { NODE_METADATA } from "@/lib/canvas/node-configs";
import type {
  NodeType,
  NodeConfig,
  StartConfig,
  ConversationConfig,
  FunctionConfig,
  CallTransferConfig,
  SetVariableConfig,
  EndConfig,
  ContentConfig,
} from "@/lib/canvas/types";
import { ConversationForm } from "./forms/conversation-form";
import { FunctionForm } from "./forms/function-form";
import { SetVariableForm } from "./forms/set-variable-form";
import { cn } from "@/lib/utils";

export function PropertiesPanel() {
  const selectedNode = useSelectedNode();
  const variables = useVariables();
  const updateNode = useCanvasStore((s) => s.updateNode);
  const selectNode = useCanvasStore((s) => s.selectNode);

  const handleConfigChange = useCallback(
    (config: NodeConfig) => {
      if (!selectedNode) return;
      updateNode(selectedNode.id, { config });
    },
    [selectedNode, updateNode]
  );

  const handleLabelChange = useCallback(
    (label: string) => {
      if (!selectedNode) return;
      updateNode(selectedNode.id, { label });
    },
    [selectedNode, updateNode]
  );

  if (!selectedNode) {
    return (
      <div className="w-80 bg-card border-l border-border flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Select a node to configure</p>
      </div>
    );
  }

  const nodeType = selectedNode.type as NodeType;
  const meta = NODE_METADATA[nodeType];
  const Icon = meta.icon;
  const config = selectedNode.data.config;

  return (
    <div className="w-80 bg-card border-l border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className={cn("px-4 py-3 border-b border-border flex items-center gap-2", meta.bgColor)}>
        <Icon className={cn("h-4 w-4", meta.color)} />
        <span className="text-sm font-semibold text-foreground flex-1">{meta.label}</span>
        <button
          onClick={() => selectNode(null)}
          className="p-1 rounded hover:bg-background/50"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Label */}
      <div className="px-4 py-3 border-b border-border">
        <label className="text-xs font-medium text-foreground mb-1.5 block">Label</label>
        <input
          value={selectedNode.data.label}
          onChange={(e) => handleLabelChange(e.target.value)}
          className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
        />
      </div>

      {/* Config Forms */}
      <div className="flex-1 overflow-y-auto p-4">
        {nodeType === "start" && (
          <StartForm config={config as StartConfig} onChange={handleConfigChange} />
        )}
        {nodeType === "conversation" && (
          <ConversationForm
            config={config as ConversationConfig}
            onChange={handleConfigChange}
          />
        )}
        {nodeType === "function" && (
          <FunctionForm
            config={config as FunctionConfig}
            onChange={handleConfigChange}
          />
        )}
        {nodeType === "call_transfer" && (
          <CallTransferForm
            config={config as CallTransferConfig}
            onChange={handleConfigChange}
          />
        )}
        {nodeType === "set_variable" && (
          <SetVariableForm
            config={config as SetVariableConfig}
            onChange={handleConfigChange}
            variables={variables}
          />
        )}
        {nodeType === "end" && (
          <EndForm config={config as EndConfig} onChange={handleConfigChange} />
        )}
      </div>

      {/* Validation Errors */}
      {selectedNode.data.validationErrors && selectedNode.data.validationErrors.length > 0 && (
        <div className="px-4 py-3 border-t border-destructive/20 bg-destructive/5">
          <p className="text-xs font-medium text-destructive mb-1">Errors</p>
          <ul className="text-xs text-destructive/80 space-y-0.5">
            {selectedNode.data.validationErrors.map((err, i) => (
              <li key={i}>&bull; {err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================
// Simple inline forms for less complex nodes
// ============================================

function StartForm({ config, onChange }: { config: StartConfig; onChange: (c: StartConfig) => void }) {
  const greeting = config.greeting ?? { mode: "static", content: "" };

  const updateGreeting = (updates: Partial<ContentConfig>) => {
    onChange({ ...config, greeting: { ...greeting, ...updates } });
  };

  return (
    <div className="space-y-4">
      {/* Speaks First */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">
          Who speaks first?
        </label>
        <div className="flex rounded-md overflow-hidden border border-border">
          <button
            onClick={() => onChange({ ...config, speaksFirst: true })}
            className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
              config.speaksFirst
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-background text-muted-foreground hover:bg-muted/50"
            }`}
          >
            Agent First
          </button>
          <button
            onClick={() => onChange({ ...config, speaksFirst: false })}
            className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
              !config.speaksFirst
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                : "bg-background text-muted-foreground hover:bg-muted/50"
            }`}
          >
            User First
          </button>
        </div>
      </div>

      {/* Greeting (only when agent speaks first) */}
      {config.speaksFirst && (
        <>
          {/* Mode toggle */}
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              Greeting Mode
            </label>
            <div className="flex rounded-md overflow-hidden border border-border">
              <button
                onClick={() => updateGreeting({ mode: "prompt" })}
                className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  greeting.mode === "prompt"
                    ? "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300"
                    : "bg-background text-muted-foreground hover:bg-muted/50"
                }`}
              >
                Prompt
              </button>
              <button
                onClick={() => updateGreeting({ mode: "static" })}
                className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  greeting.mode === "static"
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                    : "bg-background text-muted-foreground hover:bg-muted/50"
                }`}
              >
                Static
              </button>
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              {greeting.mode === "prompt" ? "Greeting Prompt" : "Greeting Message"}
            </label>
            <textarea
              value={greeting.content}
              onChange={(e) => updateGreeting({ content: e.target.value })}
              rows={3}
              placeholder={
                greeting.mode === "prompt"
                  ? "Generate a warm greeting for the caller..."
                  : "Hello! How can I help you today?"
              }
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md resize-none outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </>
      )}
    </div>
  );
}

function CallTransferForm({
  config,
  onChange,
}: {
  config: CallTransferConfig;
  onChange: (c: CallTransferConfig) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Transfer Type */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">
          Transfer Type
        </label>
        <div className="flex rounded-md overflow-hidden border border-border">
          <button
            onClick={() => onChange({ ...config, transferType: "cold" })}
            className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
              config.transferType === "cold"
                ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                : "bg-background text-muted-foreground hover:bg-muted/50"
            }`}
          >
            Cold Transfer
          </button>
          <button
            onClick={() => onChange({ ...config, transferType: "warm" })}
            className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
              config.transferType === "warm"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                : "bg-background text-muted-foreground hover:bg-muted/50"
            }`}
          >
            Warm Transfer
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          {config.transferType === "cold"
            ? "Immediately connect caller to destination."
            : "Wait for human to answer, then announce caller."}
        </p>
      </div>

      {/* Destination */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">
          Destination Number
        </label>
        <input
          value={config.destination}
          onChange={(e) => onChange({ ...config, destination: e.target.value })}
          placeholder="+1 555 123 4567 or {{variable}}"
          className="w-full px-3 py-1.5 text-sm font-mono bg-background border border-border rounded-md outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Warm Transfer Options */}
      {config.transferType === "warm" && (
        <div className="space-y-3 border-t border-border pt-3">
          <label className="text-xs font-medium text-foreground block">
            Warm Transfer Options
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.warmOptions?.holdMusic ?? false}
              onChange={(e) =>
                onChange({
                  ...config,
                  warmOptions: {
                    ...config.warmOptions,
                    holdMusic: e.target.checked,
                  },
                })
              }
              className="rounded border-border"
            />
            <span className="text-xs text-foreground">Play hold music</span>
          </label>

          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">
              Human Detection Timeout (seconds)
            </label>
            <input
              type="number"
              min={5}
              max={120}
              value={config.warmOptions?.humanDetectionTimeout ?? 30}
              onChange={(e) =>
                onChange({
                  ...config,
                  warmOptions: {
                    ...config.warmOptions,
                    humanDetectionTimeout: parseInt(e.target.value),
                  },
                })
              }
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EndForm({ config, onChange }: { config: EndConfig; onChange: (c: EndConfig) => void }) {
  const speak = config.speakDuringExecution;
  const hasFarewell = !!speak;

  const toggleFarewell = (enabled: boolean) => {
    onChange({
      ...config,
      speakDuringExecution: enabled
        ? { mode: "static", content: "Thank you for calling. Goodbye!" }
        : undefined,
    });
  };

  const updateSpeak = (updates: Partial<ContentConfig>) => {
    if (!speak) return;
    onChange({
      ...config,
      speakDuringExecution: { ...speak, ...updates },
    });
  };

  return (
    <div className="space-y-4">
      {/* Farewell Toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={hasFarewell}
          onChange={(e) => toggleFarewell(e.target.checked)}
          className="rounded border-border"
        />
        <span className="text-xs font-medium text-foreground">
          Speak farewell message
        </span>
      </label>

      {hasFarewell && speak && (
        <>
          {/* Mode toggle */}
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              Farewell Mode
            </label>
            <div className="flex rounded-md overflow-hidden border border-border">
              <button
                onClick={() => updateSpeak({ mode: "static" })}
                className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  speak.mode === "static"
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                    : "bg-background text-muted-foreground hover:bg-muted/50"
                }`}
              >
                Static
              </button>
              <button
                onClick={() => updateSpeak({ mode: "prompt" })}
                className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  speak.mode === "prompt"
                    ? "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300"
                    : "bg-background text-muted-foreground hover:bg-muted/50"
                }`}
              >
                Prompt
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              {speak.mode === "prompt" ? "Farewell Prompt" : "Farewell Message"}
            </label>
            <textarea
              value={speak.content}
              onChange={(e) => updateSpeak({ content: e.target.value })}
              rows={3}
              placeholder={
                speak.mode === "static"
                  ? "Thank you for calling. Goodbye!"
                  : "Generate a polite farewell based on the conversation..."
              }
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md resize-none outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </>
      )}

      {/* Reason */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">
          End Reason
        </label>
        <select
          value={config.reason ?? "completed"}
          onChange={(e) => onChange({ ...config, reason: e.target.value })}
          className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
        >
          <option value="completed">Completed</option>
          <option value="no_answer">No Answer</option>
          <option value="voicemail">Voicemail</option>
          <option value="cancelled">Cancelled</option>
          <option value="error">Error</option>
        </select>
      </div>
    </div>
  );
}
