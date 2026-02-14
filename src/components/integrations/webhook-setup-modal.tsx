"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Webhook, Loader2, Plus, Trash2 } from "lucide-react";

interface WebhookSetupModalProps {
  onClose: () => void;
  onConnected: () => void;
}

export function WebhookSetupModal({
  onClose,
  onConnected,
}: WebhookSetupModalProps) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addHeader = () => {
    setHeaders([...headers, { key: "", value: "" }]);
  };

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const updateHeader = (
    index: number,
    field: "key" | "value",
    val: string
  ) => {
    const updated = [...headers];
    updated[index][field] = val;
    setHeaders(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!webhookUrl.trim()) {
      setError("Webhook URL is required");
      return;
    }

    try {
      new URL(webhookUrl);
    } catch {
      setError("Invalid URL format");
      return;
    }

    setLoading(true);
    try {
      const headersObj: Record<string, string> = {};
      headers.forEach((h) => {
        if (h.key.trim()) headersObj[h.key.trim()] = h.value;
      });

      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "custom_webhook",
          webhook_url: webhookUrl.trim(),
          secret: secret.trim() || undefined,
          headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to connect webhook");
      }

      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl mx-4"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-zinc-500/10 p-2">
              <Webhook className="h-5 w-5 text-zinc-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Connect Custom Webhook</h2>
              <p className="text-sm text-muted-foreground">
                Send data to any HTTP endpoint during voice calls
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Webhook URL */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Webhook URL <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-api.com/webhook"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              required
            />
          </div>

          {/* Secret */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Secret{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Signing secret for request verification"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              If provided, requests will include an HMAC signature header
            </p>
          </div>

          {/* Custom Headers */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">
                Custom Headers{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </label>
              <button
                type="button"
                onClick={addHeader}
                className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
              >
                <Plus className="h-3 w-3" />
                Add Header
              </button>
            </div>
            {headers.map((header, idx) => (
              <div key={idx} className="mb-2 flex gap-2">
                <input
                  type="text"
                  value={header.key}
                  onChange={(e) => updateHeader(idx, "key", e.target.value)}
                  placeholder="Header name"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-violet-500"
                />
                <input
                  type="text"
                  value={header.value}
                  onChange={(e) => updateHeader(idx, "value", e.target.value)}
                  placeholder="Value"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-violet-500"
                />
                <button
                  type="button"
                  onClick={() => removeHeader(idx)}
                  className="rounded-lg border border-border p-2 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Connect Webhook
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
