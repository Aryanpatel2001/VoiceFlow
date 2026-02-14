"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Plug,
  Calendar,
  Users,
  Webhook,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { ProviderCard } from "./provider-card";
import { WebhookSetupModal } from "./webhook-setup-modal";
import { ProviderSettingsModal } from "./provider-settings-modal";

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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function IntegrationsContent() {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Modals
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [settingsModal, setSettingsModal] = useState<{
    provider: ProviderSummary;
  } | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setProviders(data.providers || []);
    } catch (err) {
      console.error("Failed to fetch integrations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Handle OAuth callback success/error from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    const provider = params.get("provider");

    if (connected) {
      setNotification({
        type: "success",
        message: `${connected} connected successfully!`,
      });
      // Clean URL
      window.history.replaceState({}, "", "/dashboard/integrations");
      fetchProviders();
    } else if (error) {
      const messages: Record<string, string> = {
        denied: `${provider || "Provider"} authorization was denied`,
        missing_params: "OAuth callback missing parameters",
        invalid_provider: "Invalid integration provider",
        invalid_state: "Invalid OAuth state - please try again",
        state_mismatch: "OAuth state mismatch - please try again",
        nonce_mismatch: "OAuth session mismatch - please try again",
        state_expired: "OAuth session expired - please try again",
        callback_failed: `Failed to connect ${provider || "provider"}`,
      };
      setNotification({
        type: "error",
        message: messages[error] || `Connection error: ${error}`,
      });
      window.history.replaceState({}, "", "/dashboard/integrations");
    }
  }, [fetchProviders]);

  // Auto-dismiss notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleConnect = async (provider: ProviderSummary) => {
    if (provider.slug === "custom_webhook") {
      setWebhookModalOpen(true);
      return;
    }

    // OAuth flow - redirect to authorize
    setActionLoading(provider.slug);
    window.location.href = `/api/integrations/oauth/${provider.slug}/authorize`;
  };

  const handleDisconnect = async (provider: ProviderSummary) => {
    setActionLoading(provider.slug);
    try {
      const res = await fetch(`/api/integrations/${provider.slug}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to disconnect");
      setNotification({
        type: "success",
        message: `${provider.name} disconnected`,
      });
      fetchProviders();
    } catch {
      setNotification({
        type: "error",
        message: `Failed to disconnect ${provider.name}`,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTest = async (provider: ProviderSummary) => {
    setActionLoading(provider.slug);
    try {
      const res = await fetch(`/api/integrations/${provider.slug}/test`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.connected) {
        setNotification({
          type: "success",
          message: `${provider.name} connection verified`,
        });
      } else {
        setNotification({
          type: "error",
          message: data.error || `${provider.name} connection test failed`,
        });
      }
      fetchProviders();
    } catch {
      setNotification({
        type: "error",
        message: `Failed to test ${provider.name}`,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSettings = (provider: ProviderSummary) => {
    setSettingsModal({ provider });
  };

  const handleWebhookConnected = () => {
    setWebhookModalOpen(false);
    setNotification({ type: "success", message: "Custom webhook connected!" });
    fetchProviders();
  };

  // Filter providers
  const filteredProviders = providers.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Stats
  const connectedCount = providers.filter(
    (p) => p.status === "connected"
  ).length;
  const errorCount = providers.filter((p) => p.status === "error").length;
  const calendarConnected = providers.some(
    (p) => p.category === "calendar" && p.status === "connected"
  );
  const crmConnected = providers.some(
    (p) => p.category === "crm" && p.status === "connected"
  );

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Notification */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
            notification.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {notification.message}
        </motion.div>
      )}

      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-muted-foreground">
          Connect third-party services to enhance your voice agents with CRM
          lookups, calendar booking, and more.
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-500/10 p-2">
              <Plug className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Connected</p>
              <p className="text-xl font-semibold">
                {connectedCount}/{providers.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <Calendar className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Calendar</p>
              <p className="text-xl font-semibold">
                {calendarConnected ? "Active" : "Not Connected"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-500/10 p-2">
              <Users className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">CRM</p>
              <p className="text-xl font-semibold">
                {crmConnected ? "Active" : "Not Connected"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-lg p-2 ${
                errorCount > 0 ? "bg-red-500/10" : "bg-emerald-500/10"
              }`}
            >
              {errorCount > 0 ? (
                <AlertCircle className="h-5 w-5 text-red-500" />
              ) : (
                <Webhook className="h-5 w-5 text-emerald-500" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {errorCount > 0 ? "Errors" : "Webhooks"}
              </p>
              <p className="text-xl font-semibold">
                {errorCount > 0
                  ? `${errorCount} issue${errorCount > 1 ? "s" : ""}`
                  : providers.filter(
                      (p) =>
                        p.category === "webhook" && p.status === "connected"
                    ).length || "None"}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-card py-2 pl-10 pr-4 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-violet-500"
        >
          <option value="all">All Categories</option>
          <option value="calendar">Calendar</option>
          <option value="crm">CRM</option>
          <option value="webhook">Webhook</option>
        </select>
        <button
          onClick={() => {
            setLoading(true);
            fetchProviders();
          }}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-accent transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </motion.div>

      {/* Provider Grid */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {filteredProviders.map((provider) => (
          <ProviderCard
            key={provider.slug}
            provider={provider}
            loading={actionLoading === provider.slug}
            onConnect={() => handleConnect(provider)}
            onDisconnect={() => handleDisconnect(provider)}
            onTest={() => handleTest(provider)}
            onSettings={() => handleSettings(provider)}
          />
        ))}
      </motion.div>

      {/* Empty State */}
      {filteredProviders.length === 0 && !loading && (
        <motion.div
          variants={itemVariants}
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center"
        >
          <Plug className="h-12 w-12 text-muted-foreground/50 mb-3" />
          <h3 className="text-lg font-medium">No integrations found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery
              ? "Try a different search term"
              : "No integrations match the current filter"}
          </p>
        </motion.div>
      )}

      {/* Webhook Setup Modal */}
      {webhookModalOpen && (
        <WebhookSetupModal
          onClose={() => setWebhookModalOpen(false)}
          onConnected={handleWebhookConnected}
        />
      )}

      {/* Settings Modal */}
      {settingsModal && (
        <ProviderSettingsModal
          provider={settingsModal.provider}
          onClose={() => setSettingsModal(null)}
          onUpdated={() => {
            setSettingsModal(null);
            fetchProviders();
          }}
        />
      )}
    </motion.div>
  );
}
