"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Zap, ArrowRight } from "lucide-react";

interface ActionField {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: unknown;
}

interface IntegrationAction {
  id: string;
  provider: string;
  name: string;
  description: string;
  category: string;
  inputSchema: ActionField[];
  outputSchema: ActionField[];
}

interface ConnectedProvider {
  slug: string;
  name: string;
  color: string;
}

interface IntegrationActionPickerProps {
  provider?: string;
  actionId?: string;
  inputs?: Record<string, string>;
  outputs?: Record<string, string>;
  onChange: (update: {
    integrationProvider?: string;
    integrationAction?: string;
    integrationInputs?: Record<string, string>;
    integrationOutputs?: Record<string, string>;
  }) => void;
}

export function IntegrationActionPicker({
  provider,
  actionId,
  inputs = {},
  outputs = {},
  onChange,
}: IntegrationActionPickerProps) {
  const [providers, setProviders] = useState<ConnectedProvider[]>([]);
  const [actions, setActions] = useState<IntegrationAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionsLoading, setActionsLoading] = useState(false);

  // Fetch connected providers
  useEffect(() => {
    async function fetchProviders() {
      try {
        const res = await fetch("/api/integrations");
        if (!res.ok) return;
        const data = await res.json();
        const connected = (data.providers || [])
          .filter((p: { status: string }) => p.status === "connected")
          .map((p: { slug: string; name: string; color: string }) => ({
            slug: p.slug,
            name: p.name,
            color: p.color,
          }));
        setProviders(connected);
      } catch (err) {
        console.error("Failed to fetch providers:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProviders();
  }, []);

  // Fetch actions when provider changes
  const fetchActions = useCallback(async (providerSlug: string) => {
    setActionsLoading(true);
    try {
      const res = await fetch(`/api/integrations/${providerSlug}/actions`);
      if (!res.ok) return;
      const data = await res.json();
      setActions(data.actions || []);
    } catch (err) {
      console.error("Failed to fetch actions:", err);
      setActions([]);
    } finally {
      setActionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (provider) {
      fetchActions(provider);
    } else {
      setActions([]);
    }
  }, [provider, fetchActions]);

  const selectedAction = actions.find((a) => a.id === actionId);

  const handleProviderChange = (slug: string) => {
    onChange({
      integrationProvider: slug || undefined,
      integrationAction: undefined,
      integrationInputs: {},
      integrationOutputs: {},
    });
  };

  const handleActionChange = (id: string) => {
    const action = actions.find((a) => a.id === id);
    if (!action) return;

    // Pre-populate output mappings with output field names as variable names
    const defaultOutputs: Record<string, string> = {};
    action.outputSchema.forEach((field) => {
      defaultOutputs[field.name] = field.name;
    });

    // Pre-populate inputs with defaults where available
    const defaultInputs: Record<string, string> = {};
    action.inputSchema.forEach((field) => {
      if (field.default !== undefined) {
        defaultInputs[field.name] = String(field.default);
      }
    });

    onChange({
      integrationProvider: provider,
      integrationAction: id,
      integrationInputs: defaultInputs,
      integrationOutputs: defaultOutputs,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center">
        <Zap className="h-5 w-5 text-muted-foreground/50 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">
          No integrations connected.
        </p>
        <a
          href="/dashboard/integrations"
          className="text-xs text-violet-400 hover:text-violet-300 mt-1 inline-block"
        >
          Connect an integration
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Provider Selection */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">
          Integration
        </label>
        <select
          value={provider || ""}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-violet-500 text-foreground"
        >
          <option value="">Select integration...</option>
          {providers.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Action Selection */}
      {provider && (
        <div>
          <label className="text-xs font-medium text-foreground mb-1.5 block">
            Action
          </label>
          {actionsLoading ? (
            <div className="flex items-center gap-2 py-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs text-muted-foreground">Loading actions...</span>
            </div>
          ) : (
            <select
              value={actionId || ""}
              onChange={(e) => handleActionChange(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:border-violet-500 text-foreground"
            >
              <option value="">Select action...</option>
              {actions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.category})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Action Description */}
      {selectedAction && (
        <p className="text-[10px] text-muted-foreground/70 -mt-2">
          {selectedAction.description}
        </p>
      )}

      {/* Input Mappings */}
      {selectedAction && selectedAction.inputSchema.length > 0 && (
        <div>
          <label className="text-xs font-medium text-foreground mb-1.5 block">
            Inputs
          </label>
          <div className="space-y-2">
            {selectedAction.inputSchema.map((field) => (
              <div key={field.name}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-medium text-foreground">
                    {field.name}
                  </span>
                  {field.required && (
                    <span className="text-[9px] text-red-400">*</span>
                  )}
                  <span className="text-[9px] text-muted-foreground/60">
                    ({field.type})
                  </span>
                </div>
                <input
                  value={inputs[field.name] || ""}
                  onChange={(e) =>
                    onChange({
                      integrationProvider: provider,
                      integrationAction: actionId,
                      integrationInputs: {
                        ...inputs,
                        [field.name]: e.target.value,
                      },
                      integrationOutputs: outputs,
                    })
                  }
                  placeholder={
                    field.default
                      ? String(field.default)
                      : `{{${field.name}}} or literal value`
                  }
                  className="w-full px-2 py-1 text-xs font-mono bg-background border border-border rounded outline-none focus:border-violet-500 text-foreground placeholder:text-muted-foreground"
                />
                <p className="text-[9px] text-muted-foreground/50 mt-0.5">
                  {field.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Output Mappings */}
      {selectedAction && selectedAction.outputSchema.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <label className="text-xs font-medium text-foreground">
              Output Mapping
            </label>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              flow variables
            </span>
          </div>
          <div className="space-y-1.5">
            {selectedAction.outputSchema.map((field) => (
              <div key={field.name} className="flex items-center gap-1.5">
                <span className="w-28 text-[10px] text-muted-foreground truncate">
                  {field.name}
                </span>
                <span className="text-[10px] text-muted-foreground">&rarr;</span>
                <input
                  value={outputs[field.name] || ""}
                  onChange={(e) =>
                    onChange({
                      integrationProvider: provider,
                      integrationAction: actionId,
                      integrationInputs: inputs,
                      integrationOutputs: {
                        ...outputs,
                        [field.name]: e.target.value,
                      },
                    })
                  }
                  placeholder={field.name}
                  className="flex-1 px-2 py-1 text-xs font-mono bg-background border border-border rounded outline-none focus:border-violet-500 text-foreground placeholder:text-muted-foreground"
                />
              </div>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground/50 mt-1">
            Action results will be saved to these flow variables.
          </p>
        </div>
      )}
    </div>
  );
}
