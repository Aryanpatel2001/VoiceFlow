/**
 * Properties Panel
 *
 * Right sidebar for configuring the selected node.
 * Renders the appropriate form based on node type.
 *
 * @module components/canvas/properties-panel
 */

"use client";

import { useCallback } from "react";
import { X } from "lucide-react";
import { useCanvasStore, useSelectedNode, useVariables } from "@/stores/canvas.store";
import { NODE_METADATA } from "@/lib/canvas/node-configs";
import type {
  NodeType,
  AIAgentConfig,
  ConditionConfig,
  APICallConfig,
  SetVariableConfig,
  StartConfig,
  TransferConfig,
  EndCallConfig,
  KnowledgeBaseConfig,
  FunctionConfig,
} from "@/lib/canvas/types";
import { AIAgentForm } from "./forms/ai-agent-form";
import { ConditionForm } from "./forms/condition-form";
import { APICallForm } from "./forms/api-call-form";
import { SetVariableForm } from "./forms/set-variable-form";
import { cn } from "@/lib/utils";

export function PropertiesPanel() {
  const selectedNode = useSelectedNode();
  const variables = useVariables();
  const updateNode = useCanvasStore((s) => s.updateNode);
  const selectNode = useCanvasStore((s) => s.selectNode);

  const handleConfigChange = useCallback(
    (config: unknown) => {
      if (!selectedNode) return;
      updateNode(selectedNode.id, { config: config as AIAgentConfig });
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
        {nodeType === "ai_agent" && (
          <AIAgentForm config={config as AIAgentConfig} onChange={handleConfigChange} />
        )}
        {nodeType === "condition" && (
          <ConditionForm
            config={config as ConditionConfig}
            onChange={handleConfigChange}
            variables={variables}
          />
        )}
        {nodeType === "set_variable" && (
          <SetVariableForm
            config={config as SetVariableConfig}
            onChange={handleConfigChange}
            variables={variables}
          />
        )}
        {nodeType === "api_call" && (
          <APICallForm config={config as APICallConfig} onChange={handleConfigChange} />
        )}
        {nodeType === "transfer" && (
          <TransferForm config={config as TransferConfig} onChange={handleConfigChange} />
        )}
        {nodeType === "end_call" && (
          <EndCallForm config={config as EndCallConfig} onChange={handleConfigChange} />
        )}
        {nodeType === "knowledge_base" && (
          <KnowledgeBaseForm config={config as KnowledgeBaseConfig} onChange={handleConfigChange} />
        )}
        {nodeType === "function" && (
          <FunctionForm config={config as FunctionConfig} onChange={handleConfigChange} />
        )}
      </div>

      {/* Validation Errors */}
      {selectedNode.data.validationErrors && selectedNode.data.validationErrors.length > 0 && (
        <div className="px-4 py-3 border-t border-destructive/20 bg-destructive/5">
          <p className="text-xs font-medium text-destructive mb-1">Errors</p>
          <ul className="text-xs text-destructive/80 space-y-0.5">
            {selectedNode.data.validationErrors.map((err, i) => (
              <li key={i}>• {err}</li>
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
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Greeting Message</label>
        <textarea
          value={config.greeting || ""}
          onChange={(e) => onChange({ ...config, greeting: e.target.value })}
          rows={3}
          placeholder="Hello! How can I help you today?"
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md resize-none outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}

function TransferForm({ config, onChange }: { config: TransferConfig; onChange: (c: TransferConfig) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Transfer Type</label>
        <select
          value={config.type}
          onChange={(e) => onChange({ ...config, type: e.target.value as TransferConfig["type"] })}
          className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
        >
          <option value="phone">Phone Number</option>
          <option value="agent">Agent ID</option>
          <option value="department">Department</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Destination</label>
        <input
          value={config.destination}
          onChange={(e) => onChange({ ...config, destination: e.target.value })}
          placeholder={config.type === "phone" ? "+1 555 123 4567" : config.type === "department" ? "sales" : "agent_id"}
          className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Message Before Transfer</label>
        <textarea
          value={config.message || ""}
          onChange={(e) => onChange({ ...config, message: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md resize-none outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="warm-transfer"
          checked={config.warmTransfer || false}
          onChange={(e) => onChange({ ...config, warmTransfer: e.target.checked })}
          className="rounded border-border"
        />
        <label htmlFor="warm-transfer" className="text-xs text-foreground">
          Warm Transfer (announce caller)
        </label>
      </div>
    </div>
  );
}

function EndCallForm({ config, onChange }: { config: EndCallConfig; onChange: (c: EndCallConfig) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Closing Message</label>
        <textarea
          value={config.message || ""}
          onChange={(e) => onChange({ ...config, message: e.target.value })}
          rows={3}
          placeholder="Thank you for calling. Goodbye!"
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md resize-none outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Reason</label>
        <select
          value={config.reason || "completed"}
          onChange={(e) => onChange({ ...config, reason: e.target.value })}
          className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
        >
          <option value="completed">Completed</option>
          <option value="no_answer">No Answer</option>
          <option value="voicemail">Voicemail</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="schedule-followup"
          checked={config.scheduleFollowUp || false}
          onChange={(e) => onChange({ ...config, scheduleFollowUp: e.target.checked })}
          className="rounded border-border"
        />
        <label htmlFor="schedule-followup" className="text-xs text-foreground">
          Schedule Follow-up
        </label>
      </div>
    </div>
  );
}

function KnowledgeBaseForm({
  config,
  onChange,
}: {
  config: KnowledgeBaseConfig;
  onChange: (c: KnowledgeBaseConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Dataset ID</label>
        <input
          value={config.datasetId}
          onChange={(e) => onChange({ ...config, datasetId: e.target.value })}
          placeholder="dataset_123"
          className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Search Query</label>
        <input
          value={config.query}
          onChange={(e) => onChange({ ...config, query: e.target.value })}
          placeholder="{{user_input}}"
          className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground font-mono placeholder:text-muted-foreground"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-foreground mb-1.5 block">Top K</label>
          <input
            type="number"
            min={1}
            max={20}
            value={config.topK}
            onChange={(e) => onChange({ ...config, topK: parseInt(e.target.value) })}
            className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground mb-1.5 block">Min Score</label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={config.minScore}
            onChange={(e) => onChange({ ...config, minScore: parseFloat(e.target.value) })}
            className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Output Variable</label>
        <input
          value={config.outputVariable}
          onChange={(e) => onChange({ ...config, outputVariable: e.target.value })}
          placeholder="kb_result"
          className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground font-mono placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}

function FunctionForm({ config, onChange }: { config: FunctionConfig; onChange: (c: FunctionConfig) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Description</label>
        <input
          value={config.description || ""}
          onChange={(e) => onChange({ ...config, description: e.target.value })}
          placeholder="What this function does..."
          className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Code</label>
        <textarea
          value={config.code}
          onChange={(e) => onChange({ ...config, code: e.target.value })}
          rows={10}
          className="w-full px-3 py-2 text-xs bg-background border border-border rounded-md resize-none outline-none focus:border-primary text-foreground font-mono"
          spellCheck={false}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">
          Input Variables (comma-separated)
        </label>
        <input
          value={config.inputVariables.join(", ")}
          onChange={(e) =>
            onChange({
              ...config,
              inputVariables: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="var1, var2"
          className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground font-mono placeholder:text-muted-foreground"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Output Variable</label>
        <input
          value={config.outputVariable}
          onChange={(e) => onChange({ ...config, outputVariable: e.target.value })}
          placeholder="function_result"
          className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground font-mono placeholder:text-muted-foreground"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Timeout (ms)</label>
        <input
          type="number"
          min={1000}
          max={30000}
          step={1000}
          value={config.timeout}
          onChange={(e) => onChange({ ...config, timeout: parseInt(e.target.value) })}
          className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
        />
      </div>
    </div>
  );
}
