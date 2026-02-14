"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  X,
  Settings,
  Loader2,
  Activity,
  Zap,
  Clock,
  AlertCircle,
} from "lucide-react";

interface ProviderSummary {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: "calendar" | "crm" | "webhook";
  status: "connected" | "disconnected" | "error";
  lastSyncAt: string | null;
  errorMessage: string | null;
  actionsCount: number;
  isOAuth: boolean;
}

interface ProviderDetail {
  provider: string;
  name: string;
  status: string;
  settings: Record<string, unknown>;
  lastSyncAt: string | null;
  errorMessage: string | null;
  actions: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
  }>;
}

interface ProviderSettingsModalProps {
  provider: ProviderSummary;
  onClose: () => void;
  onUpdated: () => void;
}

export function ProviderSettingsModal({
  provider,
  onClose,
  onUpdated,
}: ProviderSettingsModalProps) {
  const [detail, setDetail] = useState<ProviderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchDetail() {
      try {
        const res = await fetch(`/api/integrations/${provider.slug}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setDetail(data);
        // Initialize settings form
        const s: Record<string, string> = {};
        if (data.settings) {
          Object.entries(data.settings).forEach(([k, v]) => {
            s[k] = String(v || "");
          });
        }
        setSettings(s);
      } catch (err) {
        console.error("Failed to load provider detail:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [provider.slug]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/integrations/${provider.slug}/test`, {
        method: "POST",
      });
      const data = await res.json();
      setTestResult({
        success: data.connected === true,
        message: data.connected ? "Connection is healthy" : (data.error || "Test failed"),
      });
    } catch {
      setTestResult({ success: false, message: "Connection test failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/integrations/${provider.slug}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) throw new Error("Failed to save");
      onUpdated();
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  // Provider-specific setting fields
  const settingFields = getSettingFields(provider.slug);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl mx-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="rounded-lg p-2"
              style={{ backgroundColor: `${provider.color}15` }}
            >
              <Settings className="h-5 w-5" style={{ color: provider.color }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{provider.name}</h2>
              <p className="text-sm text-muted-foreground">
                Integration Settings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-accent transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Status Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Activity className="h-3 w-3" />
                  Status
                </div>
                <p
                  className={`text-sm font-medium ${
                    provider.status === "connected"
                      ? "text-emerald-400"
                      : provider.status === "error"
                        ? "text-red-400"
                        : "text-zinc-400"
                  }`}
                >
                  {provider.status === "connected"
                    ? "Connected"
                    : provider.status === "error"
                      ? "Error"
                      : "Disconnected"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Clock className="h-3 w-3" />
                  Last Sync
                </div>
                <p className="text-sm font-medium">
                  {provider.lastSyncAt
                    ? new Date(provider.lastSyncAt).toLocaleString()
                    : "Never"}
                </p>
              </div>
            </div>

            {/* Error */}
            {provider.errorMessage && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {provider.errorMessage}
              </div>
            )}

            {/* Connection Test */}
            <div>
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50 transition-colors"
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Activity className="h-4 w-4" />
                )}
                Test Connection
              </button>
              {testResult && (
                <div
                  className={`mt-2 rounded-lg p-2.5 text-xs ${
                    testResult.success
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {testResult.message}
                </div>
              )}
            </div>

            {/* Provider-specific Settings */}
            {settingFields.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3">Configuration</h3>
                <div className="space-y-3">
                  {settingFields.map((field) => (
                    <div key={field.key}>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        {field.label}
                      </label>
                      <input
                        type="text"
                        value={settings[field.key] || ""}
                        onChange={(e) =>
                          setSettings({ ...settings, [field.key]: e.target.value })
                        }
                        placeholder={field.placeholder}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                      />
                      {field.hint && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {field.hint}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available Actions */}
            {detail?.actions && detail.actions.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Available Actions ({detail.actions.length})
                </h3>
                <div className="space-y-2">
                  {detail.actions.map((action) => (
                    <div
                      key={action.id}
                      className="rounded-lg border border-border p-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{action.name}</p>
                        <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-xs text-violet-400 capitalize">
                          {action.category}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {action.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button
                onClick={onClose}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent transition-colors"
              >
                {settingFields.length > 0 ? "Cancel" : "Close"}
              </button>
              {settingFields.length > 0 && (
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Settings
                </button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// Provider-specific settings fields
function getSettingFields(
  slug: string
): Array<{
  key: string;
  label: string;
  placeholder: string;
  hint?: string;
}> {
  switch (slug) {
    case "google_calendar":
      return [
        {
          key: "default_calendar_id",
          label: "Default Calendar ID",
          placeholder: "primary",
          hint: 'Use "primary" for the main calendar, or enter a specific calendar ID',
        },
        {
          key: "default_duration",
          label: "Default Appointment Duration (minutes)",
          placeholder: "30",
        },
        {
          key: "timezone",
          label: "Timezone",
          placeholder: "America/New_York",
          hint: "IANA timezone for availability checks",
        },
      ];
    case "hubspot":
      return [
        {
          key: "default_pipeline",
          label: "Default Deal Pipeline",
          placeholder: "default",
          hint: "Pipeline ID for new deals created during calls",
        },
        {
          key: "default_deal_stage",
          label: "Default Deal Stage",
          placeholder: "appointmentscheduled",
        },
      ];
    case "salesforce":
      return [
        {
          key: "default_lead_status",
          label: "Default Lead Status",
          placeholder: "Open - Not Contacted",
        },
        {
          key: "default_opp_stage",
          label: "Default Opportunity Stage",
          placeholder: "Prospecting",
        },
      ];
    case "custom_webhook":
      return [
        {
          key: "timeout_ms",
          label: "Request Timeout (ms)",
          placeholder: "5000",
          hint: "Maximum wait time for webhook response",
        },
      ];
    default:
      return [];
  }
}
