import { create } from "zustand";
import { mergeSinglePromptConfig } from "@/lib/prompt-agent/defaults";
import type {
  PromptAgentTool,
  SinglePromptConfig,
} from "@/lib/prompt-agent/types";
import type { Flow } from "@/lib/canvas/types";

interface PromptAgentState {
  flowId: string | null;
  name: string;
  description: string;
  config: SinglePromptConfig;
  isDirty: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  error: string | null;
}

interface PromptAgentActions {
  loadFlow: (flow: Flow) => void;
  updateConfig: (patch: Partial<SinglePromptConfig>) => void;
  updateName: (name: string) => void;
  updateDescription: (description: string) => void;
  addTool: (tool: PromptAgentTool) => void;
  removeTool: (index: number) => void;
  saveFlow: () => Promise<void>;
  publishFlow: () => Promise<void>;
}

export const usePromptAgentStore = create<PromptAgentState & PromptAgentActions>(
  (set, get) => ({
    flowId: null,
    name: "",
    description: "",
    config: mergeSinglePromptConfig(),
    isDirty: false,
    isSaving: false,
    isPublishing: false,
    error: null,

    loadFlow: (flow) => {
      set({
        flowId: flow.id,
        name: flow.name,
        description: flow.description || "",
        config: mergeSinglePromptConfig(flow.flowData.settings.promptConfig),
        isDirty: false,
        error: null,
      });
    },

    updateConfig: (patch) => {
      set((state) => ({
        config: mergeSinglePromptConfig({ ...state.config, ...patch }),
        isDirty: true,
      }));
    },

    updateName: (name) => set({ name, isDirty: true }),
    updateDescription: (description) => set({ description, isDirty: true }),

    addTool: (tool) =>
      set((state) => ({
        config: { ...state.config, tools: [...state.config.tools, tool] },
        isDirty: true,
      })),

    removeTool: (index) =>
      set((state) => ({
        config: {
          ...state.config,
          tools: state.config.tools.filter((_, i) => i !== index),
        },
        isDirty: true,
      })),

    saveFlow: async () => {
      const { flowId, name, description, config } = get();
      if (!flowId) return;
      set({ isSaving: true, error: null });
      try {
        const response = await fetch(`/api/flows/${flowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            agentMode: "single_prompt",
            settings: { promptConfig: config },
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to save");
        }
        set({ isDirty: false });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : "Failed to save" });
      } finally {
        set({ isSaving: false });
      }
    },

    publishFlow: async () => {
      const { flowId } = get();
      if (!flowId) return;
      set({ isPublishing: true, error: null });
      try {
        const response = await fetch(`/api/flows/${flowId}/publish`, {
          method: "POST",
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to publish");
        }
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : "Failed to publish",
        });
      } finally {
        set({ isPublishing: false });
      }
    },
  })
);
