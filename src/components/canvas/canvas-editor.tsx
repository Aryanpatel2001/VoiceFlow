/**
 * Canvas Editor
 *
 * Main orchestrating component for the flow builder.
 * Handles flow loading, autosave, keyboard shortcuts,
 * and layout of all canvas panels.
 *
 * @module components/canvas/canvas-editor
 */

"use client";

import { useEffect, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useCanvasStore, useEditorState, useTestMode } from "@/stores/canvas.store";
import { FlowCanvas } from "./flow-canvas";
import { NodePalette } from "./node-palette";
import { PropertiesPanel } from "./properties-panel";
import { CanvasToolbar } from "./canvas-toolbar";
import { VariablesPanel } from "./variables-panel";
import { TestPanel } from "./test-panel";

interface CanvasEditorProps {
  flowId: string;
}

export function CanvasEditor({ flowId }: CanvasEditorProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVariables, setShowVariables] = useState(false);

  const loadFlow = useCanvasStore((s) => s.loadFlow);
  const resetStore = useCanvasStore((s) => s.resetStore);
  const saveFlow = useCanvasStore((s) => s.saveFlow);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);

  const { isDirty } = useEditorState();
  const { testMode, stopTest } = useTestMode();

  // Load flow on mount
  useEffect(() => {
    async function fetchFlow() {
      try {
        const response = await fetch(`/api/flows/${flowId}`);
        if (!response.ok) {
          throw new Error("Failed to load flow");
        }
        const data = await response.json();
        loadFlow(data.flow);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load flow");
      } finally {
        setLoading(false);
      }
    }

    fetchFlow();

    return () => {
      resetStore();
    };
  }, [flowId, loadFlow, resetStore]);

  // Autosave every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const { isDirty, flowId } = useCanvasStore.getState();
      if (isDirty && flowId) {
        saveFlow().catch(() => {
          // Error handled in store
        });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [saveFlow]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+S: Save
      if (isMod && e.key === "s") {
        e.preventDefault();
        saveFlow().catch(() => {});
        return;
      }

      // Cmd+Z: Undo
      if (isMod && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }

      // Cmd+Shift+Z: Redo
      if (isMod && e.shiftKey && e.key === "z") {
        e.preventDefault();
        redo();
        return;
      }

      // Delete/Backspace: Delete selected node
      if ((e.key === "Delete" || e.key === "Backspace") && selectedNodeId) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
          return;
        }
        e.preventDefault();
        deleteNode(selectedNodeId);
        return;
      }

      // Escape: Deselect
      if (e.key === "Escape") {
        selectNode(null);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveFlow, undo, redo, deleteNode, selectNode, selectedNodeId]);

  // Warn on unsaved changes before navigating away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading canvas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="text-center">
          <p className="text-sm text-destructive mb-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-4 lg:-m-6 flex flex-col h-[calc(100vh-4rem)]">
      <ReactFlowProvider>
        {/* Toolbar */}
        <CanvasToolbar
          onToggleVariables={() => setShowVariables(!showVariables)}
          showVariables={showVariables}
        />

        {/* Main Editor Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Node Palette */}
          <NodePalette />

          {/* Center: Canvas */}
          <FlowCanvas />

          {/* Right: Properties / Variables / Test */}
          {testMode ? (
            <TestPanel onClose={stopTest} />
          ) : showVariables ? (
            <VariablesPanel onClose={() => setShowVariables(false)} />
          ) : (
            <PropertiesPanel />
          )}
        </div>
      </ReactFlowProvider>
    </div>
  );
}
