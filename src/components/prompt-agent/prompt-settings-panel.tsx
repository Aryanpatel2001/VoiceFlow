"use client";

import type { SinglePromptConfig } from "@/lib/prompt-agent/types";
import { ToolEditor } from "./tool-editor";

interface PromptSettingsPanelProps {
  config: SinglePromptConfig;
  onChange: (patch: Partial<SinglePromptConfig>) => void;
  onAddTool: (tool: SinglePromptConfig["tools"][number]) => void;
  onRemoveTool: (index: number) => void;
}

export function PromptSettingsPanel({
  config,
  onChange,
  onAddTool,
  onRemoveTool,
}: PromptSettingsPanelProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-3">
        <h3 className="text-sm font-medium mb-2">Voice & Model</h3>
        <div className="space-y-2">
          <input
            value={config.voice}
            onChange={(e) => onChange({ voice: e.target.value })}
            placeholder="Voice"
            className="w-full px-2 py-1.5 text-xs border border-border rounded-md bg-background"
          />
          <select
            value={config.model}
            onChange={(e) =>
              onChange({ model: e.target.value as SinglePromptConfig["model"] })
            }
            className="w-full px-2 py-1.5 text-xs border border-border rounded-md bg-background"
          >
            <option value="gpt-4o-mini">gpt-4o-mini</option>
            <option value="gpt-4o">gpt-4o</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-border p-3">
        <h3 className="text-sm font-medium mb-2">Timing</h3>
        <div className="space-y-2">
          <input
            type="number"
            value={config.endCallAfterSilenceMs}
            onChange={(e) =>
              onChange({ endCallAfterSilenceMs: Number(e.target.value) })
            }
            placeholder="Silence timeout (ms)"
            className="w-full px-2 py-1.5 text-xs border border-border rounded-md bg-background"
          />
          <input
            type="number"
            value={config.maxCallDurationMs}
            onChange={(e) =>
              onChange({ maxCallDurationMs: Number(e.target.value) })
            }
            placeholder="Max call duration (ms)"
            className="w-full px-2 py-1.5 text-xs border border-border rounded-md bg-background"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border p-3">
        <h3 className="text-sm font-medium mb-2">Tools</h3>
        <ToolEditor onAdd={onAddTool} />
        <div className="mt-3 space-y-2">
          {config.tools.map((tool, idx) => (
            <div
              key={`${tool.type}-${idx}`}
              className="flex items-center justify-between px-2 py-1.5 text-xs border border-border rounded-md"
            >
              <span>{tool.type}</span>
              <button
                onClick={() => onRemoveTool(idx)}
                className="text-destructive hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
