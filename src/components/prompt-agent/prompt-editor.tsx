"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePromptAgentStore } from "@/stores/prompt-agent.store";
import { PromptSettingsPanel } from "./prompt-settings-panel";

interface PromptEditorProps {
  flowId: string;
}

export function PromptEditor({ flowId }: PromptEditorProps) {
  const router = useRouter();
  const {
    flowId: loadedFlowId,
    name,
    description,
    config,
    isDirty,
    isSaving,
    isPublishing,
    error,
    loadFlow,
    updateName,
    updateDescription,
    updateConfig,
    addTool,
    removeTool,
    saveFlow,
    publishFlow,
  } = usePromptAgentStore();

  useEffect(() => {
    async function fetchFlow() {
      if (loadedFlowId === flowId) return;
      const response = await fetch(`/api/flows/${flowId}`);
      if (!response.ok) return;
      const data = await response.json();
      loadFlow(data.flow);
    }
    fetchFlow();
  }, [flowId, loadedFlowId, loadFlow]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <input
            value={name}
            onChange={(e) => updateName(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
          />
          <button
            onClick={() => saveFlow()}
            disabled={isSaving}
            className="px-3 py-2 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => publishFlow()}
            disabled={isPublishing}
            className="px-3 py-2 text-xs rounded-md border border-border"
          >
            {isPublishing ? "Publishing..." : "Publish"}
          </button>
          <button
            onClick={() =>
              router.push(`/dashboard/test-call?flowId=${encodeURIComponent(flowId)}`)
            }
            className="px-3 py-2 text-xs rounded-md bg-primary/10 text-primary"
          >
            Test Call
          </button>
        </div>

        <input
          value={description}
          onChange={(e) => updateDescription(e.target.value)}
          placeholder="Description"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
        />

        <div>
          <label className="block text-sm font-medium mb-1.5">Prompt</label>
          <textarea
            value={config.prompt}
            onChange={(e) => updateConfig({ prompt: e.target.value })}
            className="w-full min-h-[280px] px-3 py-2 text-sm border border-border rounded-md bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Begin Message</label>
          <textarea
            value={config.beginMessage || ""}
            onChange={(e) => updateConfig({ beginMessage: e.target.value })}
            className="w-full min-h-[80px] px-3 py-2 text-sm border border-border rounded-md bg-background"
          />
        </div>

        {error && (
          <div className="text-xs text-destructive border border-destructive/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        {isDirty && !error && (
          <p className="text-xs text-muted-foreground">Unsaved changes</p>
        )}
      </div>

      <div className="rounded-lg border border-border p-4">
        <PromptSettingsPanel
          config={config}
          onChange={updateConfig}
          onAddTool={addTool}
          onRemoveTool={removeTool}
        />
      </div>
    </div>
  );
}
