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
import { X, FileText, Sparkles } from "lucide-react";
import { FLOW_TEMPLATES } from "@/lib/canvas/templates";
import { cn } from "@/lib/utils";

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (templateId: string | null) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Home Services": "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "Real Estate": "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  "Legal": "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  "Healthcare": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export function TemplatePicker({ open, onClose, onSelect }: TemplatePickerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleCreate = useCallback(() => {
    onSelect(selectedId);
    onClose();
  }, [selectedId, onSelect, onClose]);

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
            <h2 className="text-lg font-semibold text-foreground">Create New Flow</h2>
            <p className="text-sm text-muted-foreground">
              Start from scratch or use a template
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-accent">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Blank Flow */}
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

          {/* Templates */}
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
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Create Flow
          </button>
        </div>
      </div>
    </div>
  );
}
