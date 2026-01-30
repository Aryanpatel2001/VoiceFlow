/**
 * AI Agent Form
 *
 * Configuration form for AI Agent nodes.
 * Supports intelligent intent detection and entity extraction.
 *
 * @module components/canvas/forms/ai-agent-form
 */

"use client";

import { useCallback, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Sparkles, Target, Package } from "lucide-react";
import type { AIAgentConfig, IntentDefinition, EntityDefinition } from "@/lib/canvas/types";

interface AIAgentFormProps {
  config: AIAgentConfig;
  onChange: (config: AIAgentConfig) => void;
}

export function AIAgentForm({ config, onChange }: AIAgentFormProps) {
  const [expandedSections, setExpandedSections] = useState({
    intents: true,
    entities: false,
    advanced: false,
  });

  const update = useCallback(
    (updates: Partial<AIAgentConfig>) => {
      onChange({ ...config, ...updates });
    },
    [config, onChange]
  );

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Intent management
  const addIntent = useCallback(() => {
    const intents = [
      ...(config.intents || []),
      {
        id: `intent_${Date.now()}`,
        name: "",
        description: "",
        examples: [],
        outputHandle: "default",
      },
    ];
    update({ intents });
  }, [config.intents, update]);

  const removeIntent = useCallback(
    (id: string) => {
      const intents = (config.intents || []).filter((i) => i.id !== id);
      update({ intents });
    },
    [config.intents, update]
  );

  const updateIntent = useCallback(
    (id: string, updates: Partial<IntentDefinition>) => {
      const intents = (config.intents || []).map((i) =>
        i.id === id ? { ...i, ...updates } : i
      );
      update({ intents });
    },
    [config.intents, update]
  );

  // Entity management
  const addEntity = useCallback(() => {
    const entities = [
      ...(config.entities || []),
      {
        id: `entity_${Date.now()}`,
        name: "",
        type: "string" as const,
        description: "",
        variableName: "",
        required: false,
      },
    ];
    update({ entities });
  }, [config.entities, update]);

  const removeEntity = useCallback(
    (id: string) => {
      const entities = (config.entities || []).filter((e) => e.id !== id);
      update({ entities });
    },
    [config.entities, update]
  );

  const updateEntity = useCallback(
    (id: string, updates: Partial<EntityDefinition>) => {
      const entities = (config.entities || []).map((e) =>
        e.id === id ? { ...e, ...updates } : e
      );
      update({ entities });
    },
    [config.entities, update]
  );

  return (
    <div className="space-y-4">
      {/* System Prompt */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-primary" />
          System Prompt
        </label>
        <textarea
          value={config.systemPrompt|| ""}
          onChange={(e) => update({ systemPrompt: e.target.value })}
          rows={4}
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md resize-none outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
          placeholder="You are a helpful voice assistant for a medical clinic. Be professional, empathetic, and concise..."
        />
      </div>

      {/* Instructions */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">
          Instructions (optional)
        </label>
        <textarea
          value={config.instructions || ""}
          onChange={(e) => update({ instructions: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md resize-none outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
          placeholder="Help callers schedule appointments, answer questions about services..."
        />
      </div>

      {/* Model Selection */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-foreground mb-1.5 block">Model</label>
          <select
            value={config.model || "gpt-4o-mini"}
            onChange={(e) => update({ model: e.target.value as AIAgentConfig["model"] })}
            className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
          >
            <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
            <option value="gpt-4o">GPT-4o (Smart)</option>
            <option value="gpt-4-turbo">GPT-4 Turbo</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-foreground mb-1.5 block">Temperature</label>
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={config.temperature ?? 0.7}
            onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
            className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
          />
        </div>
      </div>

      {/* Intents Section */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("intents")}
          className="w-full px-3 py-2 flex items-center justify-between bg-muted/50 hover:bg-muted transition-colors"
        >
          <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Target className="h-3 w-3 text-blue-500" />
            Intents ({(config.intents || []).length})
          </span>
          {expandedSections.intents ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {expandedSections.intents && (
          <div className="p-3 space-y-2">
            <p className="text-[10px] text-muted-foreground">
              Define intents the AI should detect. Each intent can route to a different output.
            </p>

            {(config.intents || []).map((intent) => (
              <div key={intent.id} className="border border-border rounded-md p-2 space-y-2 bg-card">
                <div className="flex gap-2">
                  <input
                    value={intent.name}
                    onChange={(e) => updateIntent(intent.id, { name: e.target.value })}
                    placeholder="Intent name (e.g., booking)"
                    className="flex-1 px-2 py-1 text-xs bg-background border border-border rounded outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                  />
                  <input
                    value={intent.outputHandle}
                    onChange={(e) => updateIntent(intent.id, { outputHandle: e.target.value })}
                    placeholder="Output handle"
                    className="w-24 px-2 py-1 text-xs bg-background border border-border rounded outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={() => removeIntent(intent.id)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  value={intent.description}
                  onChange={(e) => updateIntent(intent.id, { description: e.target.value })}
                  placeholder="Description (e.g., User wants to book an appointment)"
                  className="w-full px-2 py-1 text-xs bg-background border border-border rounded outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                />
                <input
                  value={(intent.examples || []).join(", ")}
                  onChange={(e) =>
                    updateIntent(intent.id, {
                      examples: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder="Examples: I want to book, schedule appointment, make reservation"
                  className="w-full px-2 py-1 text-xs bg-background border border-border rounded outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                />
              </div>
            ))}

            <button
              onClick={addIntent}
              className="w-full py-1.5 text-xs text-primary hover:text-primary/80 flex items-center justify-center gap-1 border border-dashed border-border rounded-md hover:border-primary transition-colors"
            >
              <Plus className="h-3 w-3" /> Add Intent
            </button>
          </div>
        )}
      </div>

      {/* Entities Section */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("entities")}
          className="w-full px-3 py-2 flex items-center justify-between bg-muted/50 hover:bg-muted transition-colors"
        >
          <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Package className="h-3 w-3 text-green-500" />
            Entities ({(config.entities || []).length})
          </span>
          {expandedSections.entities ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {expandedSections.entities && (
          <div className="p-3 space-y-2">
            <p className="text-[10px] text-muted-foreground">
              Define entities to extract from user messages and store in variables.
            </p>

            {(config.entities || []).map((entity) => (
              <div key={entity.id} className="border border-border rounded-md p-2 space-y-2 bg-card">
                <div className="flex gap-2">
                  <input
                    value={entity.name}
                    onChange={(e) => updateEntity(entity.id, { name: e.target.value })}
                    placeholder="Entity name"
                    className="flex-1 px-2 py-1 text-xs bg-background border border-border rounded outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                  />
                  <select
                    value={entity.type}
                    onChange={(e) =>
                      updateEntity(entity.id, { type: e.target.value as EntityDefinition["type"] })
                    }
                    className="w-20 px-1.5 py-1 text-xs bg-background border border-border rounded outline-none focus:border-primary text-foreground"
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="phone">Phone</option>
                    <option value="email">Email</option>
                    <option value="boolean">Boolean</option>
                  </select>
                  <button
                    onClick={() => removeEntity(entity.id)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    value={entity.variableName}
                    onChange={(e) => updateEntity(entity.id, { variableName: e.target.value })}
                    placeholder="Variable name"
                    className="flex-1 px-2 py-1 text-xs bg-background border border-border rounded outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                  />
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={entity.required || false}
                      onChange={(e) => updateEntity(entity.id, { required: e.target.checked })}
                      className="rounded border-border"
                    />
                    Required
                  </label>
                </div>
                <input
                  value={entity.description}
                  onChange={(e) => updateEntity(entity.id, { description: e.target.value })}
                  placeholder="Description (e.g., Customer's full name)"
                  className="w-full px-2 py-1 text-xs bg-background border border-border rounded outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                />
              </div>
            ))}

            <button
              onClick={addEntity}
              className="w-full py-1.5 text-xs text-primary hover:text-primary/80 flex items-center justify-center gap-1 border border-dashed border-border rounded-md hover:border-primary transition-colors"
            >
              <Plus className="h-3 w-3" /> Add Entity
            </button>
          </div>
        )}
      </div>

      {/* Advanced Section */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("advanced")}
          className="w-full px-3 py-2 flex items-center justify-between bg-muted/50 hover:bg-muted transition-colors"
        >
          <span className="text-xs font-medium text-foreground">Advanced Settings</span>
          {expandedSections.advanced ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {expandedSections.advanced && (
          <div className="p-3 space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Max Tokens</label>
              <input
                type="number"
                min={50}
                max={4096}
                value={config.maxTokens ?? 300}
                onChange={(e) => update({ maxTokens: parseInt(e.target.value) })}
                className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Fallback Response
              </label>
              <input
                value={config.fallbackResponse || ""}
                onChange={(e) => update({ fallbackResponse: e.target.value })}
                placeholder="I'm sorry, I didn't understand. Could you rephrase?"
                className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Confidence Threshold
              </label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={config.confidenceThreshold ?? 0.7}
                onChange={(e) => update({ confidenceThreshold: parseFloat(e.target.value) })}
                className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Minimum confidence required for intent detection (0-1)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
