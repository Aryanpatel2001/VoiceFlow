"use client";

import { motion } from "framer-motion";
import {
  Calendar,
  Users,
  Webhook,
  Loader2,
  Settings,
  Unplug,
  Plug,
  Activity,
  Zap,
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

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Calendar,
  Users,
  Webhook,
  Zap,
};

function getProviderIcon(iconName: string) {
  return iconMap[iconName] || Plug;
}

const statusConfig = {
  connected: {
    label: "Connected",
    dot: "bg-emerald-400",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
  },
  disconnected: {
    label: "Not Connected",
    dot: "bg-zinc-500",
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
  },
  error: {
    label: "Error",
    dot: "bg-red-400",
    bg: "bg-red-500/10",
    text: "text-red-400",
  },
};

interface ProviderCardProps {
  provider: ProviderSummary;
  loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onTest: () => void;
  onSettings: () => void;
}

export function ProviderCard({
  provider,
  loading,
  onConnect,
  onDisconnect,
  onTest,
  onSettings,
}: ProviderCardProps) {
  const Icon = getProviderIcon(provider.icon);
  const status = statusConfig[provider.status];
  const isConnected = provider.status === "connected";
  const isError = provider.status === "error";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-border/80 hover:shadow-lg hover:shadow-black/5"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="rounded-lg p-2.5"
            style={{ backgroundColor: `${provider.color}15` }}
          >
            <Icon
              className="h-5 w-5"
              style={{ color: provider.color }}
            />
          </div>
          <div>
            <h3 className="font-medium">{provider.name}</h3>
            <p className="text-xs text-muted-foreground capitalize">
              {provider.category}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${status.bg} ${status.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </div>
      </div>

      {/* Description */}
      <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
        {provider.description}
      </p>

      {/* Metadata */}
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          {provider.actionsCount} action{provider.actionsCount !== 1 ? "s" : ""}
        </span>
        {provider.lastSyncAt && (
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {new Date(provider.lastSyncAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Error Message */}
      {isError && provider.errorMessage && (
        <div className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {provider.errorMessage}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        {loading ? (
          <div className="flex h-9 flex-1 items-center justify-center rounded-lg border border-border">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : isConnected || isError ? (
          <>
            <button
              onClick={onTest}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs hover:bg-accent transition-colors"
            >
              <Activity className="h-3.5 w-3.5" />
              Test
            </button>
            <button
              onClick={onSettings}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs hover:bg-accent transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </button>
            <button
              onClick={onDisconnect}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-red-500/30 px-3 text-xs text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
            >
              <Unplug className="h-3.5 w-3.5" />
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={onConnect}
            className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: provider.color }}
          >
            <Plug className="h-4 w-4" />
            Connect
          </button>
        )}
      </div>
    </motion.div>
  );
}
