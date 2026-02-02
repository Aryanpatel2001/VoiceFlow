/**
 * Canvas Toolbar
 *
 * Top bar with flow name, save/publish actions,
 * undo/redo, variables toggle, and test mode toggle.
 *
 * @module components/canvas/canvas-toolbar
 */

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Save,
  Upload,
  Variable,
  Play,
  Square,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore, useEditorState, useHistory, useTestMode, useFlowMetadata } from "@/stores/canvas.store";

interface CanvasToolbarProps {
  onToggleVariables: () => void;
  showVariables: boolean;
}

export function CanvasToolbar({ onToggleVariables, showVariables }: CanvasToolbarProps) {
  const router = useRouter();
  const [editingName, setEditingName] = useState(false);

  const { name } = useFlowMetadata();
  const { isDirty, isSaving, isPublishing, lastSaved } = useEditorState();
  const { canUndo, canRedo, undo, redo } = useHistory();
  const { testMode, startTest, stopTest } = useTestMode();

  const updateMetadata = useCanvasStore((s) => s.updateMetadata);
  const saveFlow = useCanvasStore((s) => s.saveFlow);
  const publishFlow = useCanvasStore((s) => s.publishFlow);
  const validate = useCanvasStore((s) => s.validate);

  const handleSave = useCallback(async () => {
    try {
      await saveFlow();
    } catch {
      // Error is stored in the store
    }
  }, [saveFlow]);

  const handlePublish = useCallback(async () => {
    try {
      const result = validate();
      if (!result.valid) return;
      await publishFlow();
    } catch {
      // Error is stored in the store
    }
  }, [publishFlow, validate]);

  const handleNameChange = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const value = e.currentTarget.value.trim();
        if (value) {
          updateMetadata({ name: value });
        }
        setEditingName(false);
      } else if (e.key === "Escape") {
        setEditingName(false);
      }
    },
    [updateMetadata]
  );

  const handleNameBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const value = e.currentTarget.value.trim();
      if (value) {
        updateMetadata({ name: value });
      }
      setEditingName(false);
    },
    [updateMetadata]
  );

  const formatLastSaved = () => {
    if (!lastSaved) return null;
    const date = new Date(lastSaved);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="h-14 bg-card border-b border-border flex items-center px-4 gap-3 shrink-0">
      {/* Back Button */}
      <button
        onClick={() => router.push("/dashboard/canvas")}
        className="p-2 rounded-md hover:bg-accent transition-colors"
      >
        <ArrowLeft className="h-4 w-4 text-foreground" />
      </button>

      {/* Flow Name */}
      <div className="flex items-center gap-2 min-w-0">
        {editingName ? (
          <input
            autoFocus
            defaultValue={name}
            onKeyDown={handleNameChange}
            onBlur={handleNameBlur}
            className="text-sm font-medium bg-transparent border border-border rounded px-2 py-1 text-foreground outline-none focus:border-primary"
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="text-sm font-medium text-foreground hover:text-primary truncate max-w-[200px]"
          >
            {name}
          </button>
        )}

        {/* Save Status */}
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {isSaving ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </span>
          ) : isDirty ? (
            <span className="text-yellow-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Unsaved
            </span>
          ) : lastSaved ? (
            <span className="flex items-center gap-1">
              <Check className="h-3 w-3 text-green-600" />
              Saved {formatLastSaved()}
            </span>
          ) : null}
        </span>
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-border mx-1" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <button
          onClick={undo}
          disabled={!canUndo}
          className={cn(
            "p-2 rounded-md transition-colors",
            canUndo ? "hover:bg-accent text-foreground" : "text-muted-foreground/40 cursor-not-allowed"
          )}
          title="Undo (Cmd+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className={cn(
            "p-2 rounded-md transition-colors",
            canRedo ? "hover:bg-accent text-foreground" : "text-muted-foreground/40 cursor-not-allowed"
          )}
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </button>
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-border mx-1" />

      {/* Variables */}
      <button
        onClick={onToggleVariables}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
          showVariables
            ? "bg-primary/10 text-primary"
            : "hover:bg-accent text-foreground"
        )}
      >
        <Variable className="h-4 w-4" />
        Variables
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Test Mode */}
      <button
        onClick={testMode ? stopTest : startTest}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          testMode
            ? "bg-red-500/10 text-red-600 hover:bg-red-500/20"
            : "bg-green-500/10 text-green-600 hover:bg-green-500/20"
        )}
      >
        {testMode ? (
          <>
            <Square className="h-4 w-4" />
            Stop Test
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            Test
          </>
        )}
      </button>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={!isDirty || isSaving}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          isDirty && !isSaving
            ? "bg-accent hover:bg-accent/80 text-foreground"
            : "text-muted-foreground/40 cursor-not-allowed"
        )}
      >
        <Save className="h-4 w-4" />
        Save
      </button>

      {/* Publish */}
      <button
        onClick={handlePublish}
        disabled={isPublishing}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isPublishing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        Publish
      </button>
    </div>
  );
}
