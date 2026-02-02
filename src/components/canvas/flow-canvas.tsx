/**
 * Flow Canvas
 *
 * Main React Flow canvas wrapper.
 * Handles drag-and-drop, node connections, and viewport management.
 *
 * @module components/canvas/flow-canvas
 */

"use client";

import { useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type ReactFlowInstance,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useCanvasStore } from "@/stores/canvas.store";
import { nodeTypes } from "./nodes";
import type { NodeType } from "@/lib/canvas/types";

export function FlowCanvas() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reactFlowRef = useRef<ReactFlowInstance<any, any> | null>(null);

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange) as unknown as OnNodesChange;
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange) as unknown as OnEdgesChange;
  const onConnect = useCanvasStore((s) => s.onConnect) as unknown as OnConnect;
  const addNode = useCanvasStore((s) => s.addNode);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const setViewport = useCanvasStore((s) => s.setViewport);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onInit = useCallback((instance: ReactFlowInstance<any, any>) => {
    reactFlowRef.current = instance;
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData("application/voiceflow-node") as NodeType;
      if (!nodeType || !reactFlowRef.current) return;

      const position = reactFlowRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(nodeType, position);
    },
    [addNode]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const onMoveEnd = useCallback(
    (_event: unknown, viewport: { x: number; y: number; zoom: number }) => {
      setViewport(viewport);
    },
    [setViewport]
  );

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onPaneClick={onPaneClick}
        onMoveEnd={onMoveEnd}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: true,
          style: { strokeWidth: 2 },
        }}
        deleteKeyCode={["Backspace", "Delete"]}
        className="bg-background"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          className="!bg-background"
        />
        <Controls
          showInteractive={false}
          className="!bg-card !border-border !shadow-sm [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-muted"
        />
        <MiniMap
          className="!bg-card !border-border !shadow-sm"
          maskColor="rgba(0, 0, 0, 0.1)"
          nodeColor={(node) => {
            const colorMap: Record<string, string> = {
              start: "#16a34a",
              conversation: "#9333ea",
              function: "#475569",
              call_transfer: "#ca8a04",
              set_variable: "#2563eb",
              end: "#dc2626",
            };
            return colorMap[node.type || ""] || "#6b7280";
          }}
        />
      </ReactFlow>
    </div>
  );
}
