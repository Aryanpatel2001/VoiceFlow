/**
 * Template Picker
 *
 * Dialog for selecting a pre-built flow template.
 * Shows template cards with descriptions and preview info.
 *
 * @module components/canvas/template-picker
 */

"use client";

import { useState, useCallback } from "react";
import { X, FileText, Sparkles, MessageCircle, Workflow } from "lucide-react";
import { FLOW_TEMPLATES } from "@/lib/canvas/templates";
import { cn } from "@/lib/utils";
import type { AgentMode } from "@/lib/prompt-agent/types";

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (selection: {
    agentMode: AgentMode;
    templateId: string | null;
    name?: string;
  }) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Home Services": "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "Real Estate": "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  "Legal": "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  "Healthcare": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export function TemplatePicker({ open, onClose, onSelect }: TemplatePickerProps) {
  const [mode, setMode] = useState<AgentMode | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [singlePromptName, setSinglePromptName] = useState("Untitled Prompt Agent");

  const handleCreate = useCallback(() => {
    if (!mode) return;
    onSelect({
      agentMode: mode,
      templateId: mode === "canvas" ? selectedId : null,
      name: mode === "single_prompt" ? singlePromptName : undefined,
    });
    setMode(null);
    setSelectedId(null);
    onClose();
  }, [mode, selectedId, singlePromptName, onSelect, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Create New Agent</h2>
            <p className="text-sm text-muted-foreground">
              Choose a build mode first, then continue
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-accent">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {!mode && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setMode("single_prompt")}
                className="flex flex-col items-start gap-2 p-4 border border-border rounded-lg hover:border-primary/60 transition-colors text-left"
              >
                <div className="p-2 rounded-md bg-primary/10">
                  <MessageCircle className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Single Prompt</p>
                <p className="text-xs text-muted-foreground">
                  Use one comprehensive prompt. Best for quick, simple agents.
                </p>
              </button>
              <button
                onClick={() => setMode("canvas")}
                className="flex flex-col items-start gap-2 p-4 border border-border rounded-lg hover:border-primary/60 transition-colors text-left"
              >
                <div className="p-2 rounded-md bg-primary/10">
                  <Workflow className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Canvas Flow</p>
                <p className="text-xs text-muted-foreground">
                  Build with visual nodes and transitions for complex workflows.
                </p>
              </button>
            </div>
          )}

          {mode === "single_prompt" && (
            <div className="space-y-4">
              <button
                onClick={() => setMode(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ← Back to mode selection
              </button>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Agent Name
                </label>
                <input
                  value={singlePromptName}
                  onChange={(e) => setSinglePromptName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                  placeholder="Untitled Prompt Agent"
                />
              </div>
            </div>
          )}

          {mode === "canvas" && (
            <>
              <button
                onClick={() => setMode(null)}
                className="text-xs text-muted-foreground hover:text-foreground mb-4"
              >
                ← Back to mode selection
              </button>
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Blank
                </h3>
                <button
                  onClick={() => setSelectedId(null)}
                  className={cn(
                    "w-full flex items-center gap-3 p-4 border rounded-lg transition-all text-left",
                    selectedId === null
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="p-2 bg-muted rounded-lg">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Blank Flow</p>
                    <p className="text-xs text-muted-foreground">
                      Start with an empty canvas and a Start node
                    </p>
                  </div>
                </button>
              </div>

              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Templates
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {FLOW_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedId(template.id)}
                    className={cn(
                      "flex flex-col p-4 border rounded-lg transition-all text-left",
                      selectedId === template.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <div className="p-1.5 bg-primary/10 rounded">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {template.name}
                        </p>
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-block mt-1",
                            CATEGORY_COLORS[template.category] || "bg-muted text-muted-foreground"
                          )}
                        >
                          {template.category}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {template.description}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      {template.nodes.length} nodes
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!mode}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Create Agent
          </button>
        </div>
      </div>
    </div>
  );
}
