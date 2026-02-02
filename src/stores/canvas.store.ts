/**
 * Canvas Store
 *
 * Zustand store for the Agent Canvas flow builder.
 * Manages flow data, editor state, history (undo/redo), and test mode.
 *
 * @module stores/canvas
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { useShallow } from "zustand/react/shallow";
import type { Connection, NodeChange, EdgeChange } from "@xyflow/react";

import type {
  Flow,
  FlowNode,
  FlowEdge,
  FlowVariable,
  FlowSettings,
  FlowMetadata,
  FlowSnapshot,
  NodeType,
  ExecutionState,
  ValidationResult,
} from "@/lib/canvas/types";
import { getDefaultConfig, NODE_METADATA } from "@/lib/canvas/node-configs";
import { validateFlow, quickValidateNode } from "@/lib/canvas/validation";
import { FlowExecutor } from "@/lib/canvas/execution-engine";

// ============================================
// Types
// ============================================

interface CanvasState {
  // Flow identity
  flowId: string | null;
  organizationId: string | null;

  // Flow metadata
  metadata: FlowMetadata;

  // Flow data
  nodes: FlowNode[];
  edges: FlowEdge[];

  // Editor state
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  isDirty: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  lastSaved: Date | null;
  lastError: string | null;

  // Validation
  validation: ValidationResult | null;

  // History (undo/redo)
  history: FlowSnapshot[];
  historyIndex: number;
  maxHistory: number;

  // Test mode
  testMode: boolean;
  testModeType: "simulation" | "live";
  testExecutor: FlowExecutor | null;
  testState: ExecutionState | null;

  // Viewport
  viewport: { x: number; y: number; zoom: number };
}

interface CanvasActions {
  // Initialization
  loadFlow: (flow: Flow) => void;
  resetStore: () => void;

  // Node operations
  addNode: (type: NodeType, position: { x: number; y: number }) => void;
  updateNode: (nodeId: string, data: Partial<FlowNode["data"]>) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  deleteNode: (nodeId: string) => void;
  selectNode: (nodeId: string | null) => void;
  duplicateNode: (nodeId: string) => void;

  // Edge operations
  addEdge: (connection: Connection) => void;
  updateEdge: (edgeId: string, data: Partial<FlowEdge>) => void;
  deleteEdge: (edgeId: string) => void;
  selectEdge: (edgeId: string | null) => void;

  // React Flow handlers
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  onConnect: (connection: Connection) => void;

  // Variable operations
  addVariable: (variable: Omit<FlowVariable, "id">) => void;
  updateVariable: (variableId: string, updates: Partial<FlowVariable>) => void;
  deleteVariable: (variableId: string) => void;

  // Metadata operations
  updateMetadata: (updates: Partial<FlowMetadata>) => void;
  updateSettings: (updates: Partial<FlowSettings>) => void;

  // History operations
  undo: () => void;
  redo: () => void;
  takeSnapshot: () => void;
  clearHistory: () => void;

  // Persistence
  saveFlow: () => Promise<void>;
  publishFlow: () => Promise<void>;

  // Validation
  validate: () => ValidationResult;
  validateNode: (nodeId: string) => string[];

  // Test mode
  startTest: () => void;
  stopTest: () => void;
  setTestModeType: (type: "simulation" | "live") => void;
  sendTestMessage: (message: string) => Promise<void>;

  // Viewport
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;

  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;
}

type CanvasStore = CanvasState & CanvasActions;

// ============================================
// Initial State
// ============================================

const DEFAULT_SETTINGS: FlowSettings = {
  defaultVoice: "21m00Tcm4TlvDq8ikWAM",
  language: "en-US",
  timeout: 30000,
  maxTurns: 20,
  recordCalls: true,
  transcribeCalls: true,
};

const initialState: CanvasState = {
  flowId: null,
  organizationId: null,
  metadata: {
    id: "",
    name: "Untitled Flow",
    description: undefined,
    variables: [],
    settings: DEFAULT_SETTINGS,
  },
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  isDirty: false,
  isSaving: false,
  isPublishing: false,
  lastSaved: null,
  lastError: null,
  validation: null,
  history: [],
  historyIndex: -1,
  maxHistory: 50,
  testMode: false,
  testModeType: "simulation",
  testExecutor: null,
  testState: null,
  viewport: { x: 0, y: 0, zoom: 1 },
};

// ============================================
// Store Implementation
// ============================================

export const useCanvasStore = create<CanvasStore>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // ============================================
      // Initialization
      // ============================================

      loadFlow: (flow: Flow) => {
        set((state) => {
          state.flowId = flow.id;
          state.organizationId = flow.organizationId;
          state.metadata = {
            id: flow.id,
            name: flow.name,
            description: flow.description,
            variables: flow.flowData.variables,
            settings: flow.flowData.settings,
          };
          state.nodes = flow.flowData.nodes;
          state.edges = flow.flowData.edges;
          state.isDirty = false;
          state.lastSaved = flow.updatedAt;
          state.history = [];
          state.historyIndex = -1;
          state.selectedNodeId = null;
          state.selectedEdgeId = null;
          state.testMode = false;
          state.testExecutor = null;
          state.testState = null;
          state.lastError = null;
        });

        // Take initial snapshot
        get().takeSnapshot();
      },

      resetStore: () => {
        set(initialState);
      },

      // ============================================
      // Node Operations
      // ============================================

      addNode: (type: NodeType, position: { x: number; y: number }) => {
        const nodeId = `${type}_${Date.now()}`;
        const meta = NODE_METADATA[type];

        set((state) => {
          const newNode: FlowNode = {
            id: nodeId,
            type,
            position,
            data: {
              label: meta.label,
              config: getDefaultConfig(type),
            },
          };

          state.nodes.push(newNode);
          state.selectedNodeId = nodeId;
          state.isDirty = true;
        });

        get().takeSnapshot();
      },

      updateNode: (nodeId: string, data: Partial<FlowNode["data"]>) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId);
          if (node) {
            Object.assign(node.data, data);
            state.isDirty = true;
          }
        });

        get().takeSnapshot();
      },

      updateNodePosition: (nodeId: string, position: { x: number; y: number }) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId);
          if (node) {
            node.position = position;
            state.isDirty = true;
          }
        });
        // Don't take snapshot for position changes (too frequent)
      },

      deleteNode: (nodeId: string) => {
        set((state) => {
          state.nodes = state.nodes.filter((n) => n.id !== nodeId);
          state.edges = state.edges.filter(
            (e) => e.source !== nodeId && e.target !== nodeId
          );
          if (state.selectedNodeId === nodeId) {
            state.selectedNodeId = null;
          }
          state.isDirty = true;
        });

        get().takeSnapshot();
      },

      selectNode: (nodeId: string | null) => {
        set((state) => {
          state.selectedNodeId = nodeId;
          state.selectedEdgeId = null;
        });
      },

      duplicateNode: (nodeId: string) => {
        const { nodes } = get();
        const original = nodes.find((n) => n.id === nodeId);
        if (!original || original.type === "start") return;

        const newId = `${original.type}_${Date.now()}`;

        set((state) => {
          const newNode: FlowNode = {
            ...original,
            id: newId,
            position: {
              x: original.position.x + 50,
              y: original.position.y + 50,
            },
            data: {
              ...original.data,
              label: `${original.data.label} (Copy)`,
            },
          };

          state.nodes.push(newNode);
          state.selectedNodeId = newId;
          state.isDirty = true;
        });

        get().takeSnapshot();
      },

      // ============================================
      // Edge Operations
      // ============================================

      addEdge: (connection: Connection) => {
        if (!connection.source || !connection.target) return;

        const edgeId = `${connection.source}-${connection.target}-${connection.sourceHandle || "default"}`;

        set((state) => {
          // Remove existing edge from same source handle
          state.edges = state.edges.filter(
            (e) =>
              !(e.source === connection.source && e.sourceHandle === connection.sourceHandle)
          );

          const newEdge: FlowEdge = {
            id: edgeId,
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle || undefined,
            targetHandle: connection.targetHandle || undefined,
          };

          state.edges.push(newEdge);
          state.isDirty = true;
        });

        get().takeSnapshot();
      },

      updateEdge: (edgeId: string, data: Partial<FlowEdge>) => {
        set((state) => {
          const edge = state.edges.find((e) => e.id === edgeId);
          if (edge) {
            Object.assign(edge, data);
            state.isDirty = true;
          }
        });

        get().takeSnapshot();
      },

      deleteEdge: (edgeId: string) => {
        set((state) => {
          state.edges = state.edges.filter((e) => e.id !== edgeId);
          if (state.selectedEdgeId === edgeId) {
            state.selectedEdgeId = null;
          }
          state.isDirty = true;
        });

        get().takeSnapshot();
      },

      selectEdge: (edgeId: string | null) => {
        set((state) => {
          state.selectedEdgeId = edgeId;
          state.selectedNodeId = null;
        });
      },

      // ============================================
      // React Flow Handlers
      // ============================================

      onNodesChange: (changes: NodeChange<FlowNode>[]) => {
        set((state) => {
          // Apply changes manually for immer compatibility
          for (const change of changes) {
            if (change.type === "position" && change.position) {
              const node = state.nodes.find((n) => n.id === change.id);
              if (node) {
                node.position = change.position;
              }
            } else if (change.type === "select") {
              if (change.selected) {
                state.selectedNodeId = change.id;
                state.selectedEdgeId = null;
              } else if (state.selectedNodeId === change.id) {
                state.selectedNodeId = null;
              }
            } else if (change.type === "remove") {
              state.nodes = state.nodes.filter((n) => n.id !== change.id);
              state.edges = state.edges.filter(
                (e) => e.source !== change.id && e.target !== change.id
              );
              if (state.selectedNodeId === change.id) {
                state.selectedNodeId = null;
              }
              state.isDirty = true;
            }
          }
        });
      },

      onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => {
        set((state) => {
          for (const change of changes) {
            if (change.type === "select") {
              if (change.selected) {
                state.selectedEdgeId = change.id;
                state.selectedNodeId = null;
              } else if (state.selectedEdgeId === change.id) {
                state.selectedEdgeId = null;
              }
            } else if (change.type === "remove") {
              state.edges = state.edges.filter((e) => e.id !== change.id);
              if (state.selectedEdgeId === change.id) {
                state.selectedEdgeId = null;
              }
              state.isDirty = true;
            }
          }
        });
      },

      onConnect: (connection: Connection) => {
        get().addEdge(connection);
      },

      // ============================================
      // Variable Operations
      // ============================================

      addVariable: (variable: Omit<FlowVariable, "id">) => {
        const variableId = `var_${Date.now()}`;

        set((state) => {
          state.metadata.variables.push({
            ...variable,
            id: variableId,
          });
          state.isDirty = true;
        });

        get().takeSnapshot();
      },

      updateVariable: (variableId: string, updates: Partial<FlowVariable>) => {
        set((state) => {
          const variable = state.metadata.variables.find((v) => v.id === variableId);
          if (variable) {
            Object.assign(variable, updates);
            state.isDirty = true;
          }
        });

        get().takeSnapshot();
      },

      deleteVariable: (variableId: string) => {
        set((state) => {
          state.metadata.variables = state.metadata.variables.filter(
            (v) => v.id !== variableId
          );
          state.isDirty = true;
        });

        get().takeSnapshot();
      },

      // ============================================
      // Metadata Operations
      // ============================================

      updateMetadata: (updates: Partial<FlowMetadata>) => {
        set((state) => {
          Object.assign(state.metadata, updates);
          state.isDirty = true;
        });
      },

      updateSettings: (updates: Partial<FlowSettings>) => {
        set((state) => {
          Object.assign(state.metadata.settings, updates);
          state.isDirty = true;
        });
      },

      // ============================================
      // History Operations
      // ============================================

      takeSnapshot: () => {
        set((state) => {
          const snapshot: FlowSnapshot = {
            nodes: JSON.parse(JSON.stringify(state.nodes)),
            edges: JSON.parse(JSON.stringify(state.edges)),
            variables: JSON.parse(JSON.stringify(state.metadata.variables)),
            timestamp: new Date(),
          };

          // Remove future history if we're not at the end
          if (state.historyIndex < state.history.length - 1) {
            state.history = state.history.slice(0, state.historyIndex + 1);
          }

          state.history.push(snapshot);

          // Limit history size
          if (state.history.length > state.maxHistory) {
            state.history.shift();
          } else {
            state.historyIndex++;
          }
        });
      },

      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex <= 0) return;

        const previousIndex = historyIndex - 1;
        const snapshot = history[previousIndex];

        set((state) => {
          state.nodes = JSON.parse(JSON.stringify(snapshot.nodes));
          state.edges = JSON.parse(JSON.stringify(snapshot.edges));
          state.metadata.variables = JSON.parse(JSON.stringify(snapshot.variables));
          state.historyIndex = previousIndex;
          state.isDirty = true;
          state.selectedNodeId = null;
          state.selectedEdgeId = null;
        });
      },

      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex >= history.length - 1) return;

        const nextIndex = historyIndex + 1;
        const snapshot = history[nextIndex];

        set((state) => {
          state.nodes = JSON.parse(JSON.stringify(snapshot.nodes));
          state.edges = JSON.parse(JSON.stringify(snapshot.edges));
          state.metadata.variables = JSON.parse(JSON.stringify(snapshot.variables));
          state.historyIndex = nextIndex;
          state.isDirty = true;
          state.selectedNodeId = null;
          state.selectedEdgeId = null;
        });
      },

      clearHistory: () => {
        set((state) => {
          state.history = [];
          state.historyIndex = -1;
        });
        get().takeSnapshot();
      },

      // ============================================
      // Persistence
      // ============================================

      saveFlow: async () => {
        const { flowId, nodes, edges, metadata, isDirty } = get();
        if (!flowId || !isDirty) return;

        set((state) => {
          state.isSaving = true;
          state.lastError = null;
        });

        try {
          const response = await fetch(`/api/flows/${flowId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: metadata.name,
              description: metadata.description,
              nodes,
              edges,
              variables: metadata.variables,
              settings: metadata.settings,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to save flow");
          }

          set((state) => {
            state.isDirty = false;
            state.lastSaved = new Date();
            state.isSaving = false;
          });
        } catch (error) {
          set((state) => {
            state.isSaving = false;
            state.lastError = error instanceof Error ? error.message : "Save failed";
          });
          throw error;
        }
      },

      publishFlow: async () => {
        const { flowId } = get();
        if (!flowId) return;

        // Validate first
        const validation = get().validate();
        if (!validation.valid) {
          throw new Error(`Cannot publish: ${validation.errors[0]?.message}`);
        }

        // Save first if dirty
        if (get().isDirty) {
          await get().saveFlow();
        }

        set((state) => {
          state.isPublishing = true;
          state.lastError = null;
        });

        try {
          const response = await fetch(`/api/flows/${flowId}/publish`, {
            method: "POST",
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Failed to publish");
          }

          set((state) => {
            state.isPublishing = false;
          });
        } catch (error) {
          set((state) => {
            state.isPublishing = false;
            state.lastError = error instanceof Error ? error.message : "Publish failed";
          });
          throw error;
        }
      },

      // ============================================
      // Validation
      // ============================================

      validate: () => {
        const { nodes, edges, metadata } = get();
        const result = validateFlow(nodes, edges, metadata.variables);

        set((state) => {
          state.validation = result;

          // Update node validation errors
          for (const node of state.nodes) {
            const nodeErrors = result.errors
              .filter((e) => e.nodeId === node.id)
              .map((e) => e.message);
            node.data.validationErrors = nodeErrors.length > 0 ? nodeErrors : undefined;
          }
        });

        return result;
      },

      validateNode: (nodeId: string) => {
        const { nodes, metadata } = get();
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return [];

        return quickValidateNode(node, metadata.variables);
      },

      // ============================================
      // Test Mode
      // ============================================

      startTest: () => {
        const { nodes, edges, metadata, testModeType } = get();

        // Deep clone to avoid passing Immer-frozen objects to the executor
        const clonedNodes = JSON.parse(JSON.stringify(nodes));
        const clonedEdges = JSON.parse(JSON.stringify(edges));
        const clonedVariables = JSON.parse(JSON.stringify(metadata.variables));

        const executor = new FlowExecutor(
          clonedNodes,
          clonedEdges,
          clonedVariables,
          testModeType
        );

        set((state) => {
          state.testMode = true;
          state.testExecutor = executor;
          state.testState = executor.getState();
        });

        // Execute start node automatically
        get().sendTestMessage("");
      },

      stopTest: () => {
        set((state) => {
          state.testMode = false;
          state.testExecutor = null;
          state.testState = null;
        });
      },

      setTestModeType: (type: "simulation" | "live") => {
        set((state) => {
          state.testModeType = type;
        });
      },

      sendTestMessage: async (message: string) => {
        const { testExecutor } = get();
        if (!testExecutor) return;

        await testExecutor.executeCurrentNode(message || undefined);

        set((state) => {
          state.testState = testExecutor.getState();
        });
      },

      // ============================================
      // Viewport
      // ============================================

      setViewport: (viewport: { x: number; y: number; zoom: number }) => {
        set((state) => {
          state.viewport = viewport;
        });
      },

      // ============================================
      // Error Handling
      // ============================================

      setError: (error: string | null) => {
        set((state) => {
          state.lastError = error;
        });
      },

      clearError: () => {
        set((state) => {
          state.lastError = null;
        });
      },
    })),
    { name: "canvas-store" }
  )
);

// ============================================
// Selectors (with useShallow for performance)
// ============================================

export function useFlowMetadata() {
  return useCanvasStore(
    useShallow((s) => ({
      id: s.flowId,
      name: s.metadata.name,
      description: s.metadata.description,
      status: s.isDirty ? "unsaved" : "saved",
    }))
  );
}

export function useEditorState() {
  return useCanvasStore(
    useShallow((s) => ({
      isDirty: s.isDirty,
      isSaving: s.isSaving,
      isPublishing: s.isPublishing,
      lastSaved: s.lastSaved,
      lastError: s.lastError,
    }))
  );
}

export function useSelection() {
  return useCanvasStore(
    useShallow((s) => ({
      selectedNodeId: s.selectedNodeId,
      selectedEdgeId: s.selectedEdgeId,
    }))
  );
}

export function useSelectedNode() {
  const { selectedNodeId, nodes } = useCanvasStore(
    useShallow((s) => ({
      selectedNodeId: s.selectedNodeId,
      nodes: s.nodes,
    }))
  );

  return selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;
}

export function useVariables() {
  return useCanvasStore((s) => s.metadata.variables);
}

export function useHistory() {
  return useCanvasStore(
    useShallow((s) => ({
      canUndo: s.historyIndex > 0,
      canRedo: s.historyIndex < s.history.length - 1,
      undo: s.undo,
      redo: s.redo,
    }))
  );
}

export function useTestMode() {
  return useCanvasStore(
    useShallow((s) => ({
      testMode: s.testMode,
      testModeType: s.testModeType,
      testState: s.testState,
      startTest: s.startTest,
      stopTest: s.stopTest,
      setTestModeType: s.setTestModeType,
      sendTestMessage: s.sendTestMessage,
    }))
  );
}

export function useValidation() {
  return useCanvasStore(
    useShallow((s) => ({
      validation: s.validation,
      validate: s.validate,
    }))
  );
}
