/**
 * Webhook Logs Content
 *
 * Displays webhook logs with filters and detailed view.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Webhook,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  X,
  RefreshCw,
  Activity,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WebhookLog {
  id: string;
  organizationId: string;
  flowId: string | null;
  webhookId: string;
  method: string;
  path: string;
  statusCode: number;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  responseBody: unknown;
  responseTimeMs: number;
  error: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface WebhookStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTimeMs: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export function WebhookLogsContent() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [hasErrorFilter, setHasErrorFilter] = useState<string>("");

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 20;

  // Detail modal
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);

  // Fetch stats
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/webhook-logs?stats=true");
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
        }
      } catch {
        // Ignore stats fetch errors
      }
    }
    fetchStats();
  }, []);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: ((page - 1) * limit).toString(),
      });

      if (statusFilter) {
        params.set("statusCode", statusFilter);
      }
      if (hasErrorFilter) {
        params.set("hasError", hasErrorFilter);
      }

      const res = await fetch(`/api/webhook-logs?${params}`);
      if (!res.ok) {
        throw new Error("Failed to fetch webhook logs");
      }

      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    } catch {
      setError("Failed to load webhook logs");
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, hasErrorFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "text-success";
    if (status >= 400 && status < 500) return "text-warning";
    return "text-destructive";
  };

  const getStatusBg = (status: number) => {
    if (status >= 200 && status < 300) return "bg-success/10";
    if (status >= 400 && status < 500) return "bg-warning/10";
    return "bg-destructive/10";
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">{error}</h2>
        <button onClick={fetchLogs} className="btn-secondary mt-4">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Webhook Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor incoming webhook requests to your flows
          </p>
        </div>

        <button onClick={fetchLogs} className="btn-secondary">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </motion.div>

      {/* Stats */}
      {stats && (
        <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card-premium p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Activity className="h-4 w-4" />
              <span className="text-xs">Total Requests</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {stats.totalRequests.toLocaleString()}
            </p>
          </div>
          <div className="card-premium p-4">
            <div className="flex items-center gap-2 text-success mb-2">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs">Successful</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {stats.successfulRequests.toLocaleString()}
            </p>
          </div>
          <div className="card-premium p-4">
            <div className="flex items-center gap-2 text-destructive mb-2">
              <XCircle className="h-4 w-4" />
              <span className="text-xs">Failed</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {stats.failedRequests.toLocaleString()}
            </p>
          </div>
          <div className="card-premium p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Zap className="h-4 w-4" />
              <span className="text-xs">Avg Response</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {stats.avgResponseTimeMs.toFixed(0)}ms
            </p>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex flex-wrap gap-3">
        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="input-field !w-auto min-w-[150px]"
        >
          <option value="">All Status Codes</option>
          <option value="200">200 OK</option>
          <option value="201">201 Created</option>
          <option value="400">400 Bad Request</option>
          <option value="401">401 Unauthorized</option>
          <option value="404">404 Not Found</option>
          <option value="500">500 Server Error</option>
        </select>

        {/* Error Filter */}
        <select
          value={hasErrorFilter}
          onChange={(e) => {
            setHasErrorFilter(e.target.value);
            setPage(1);
          }}
          className="input-field !w-auto min-w-[150px]"
        >
          <option value="">All Requests</option>
          <option value="false">Successful Only</option>
          <option value="true">Errors Only</option>
        </select>

        {/* Clear Filters */}
        {(statusFilter || hasErrorFilter) && (
          <button
            onClick={() => {
              setStatusFilter("");
              setHasErrorFilter("");
              setPage(1);
            }}
            className="btn-ghost text-sm"
          >
            <X className="h-4 w-4" />
            Clear Filters
          </button>
        )}
      </motion.div>

      {/* Logs Table */}
      <motion.div variants={itemVariants} className="card-premium !p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Webhook className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No webhook logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">
                    Method
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">
                    Path
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">
                    Response Time
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">
                    Time
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr
                    key={log.id}
                    className={cn(
                      "border-b border-border/50 transition-colors hover:bg-muted/50",
                      index === logs.length - 1 && "border-b-0"
                    )}
                  >
                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          getStatusBg(log.statusCode),
                          getStatusColor(log.statusCode)
                        )}
                      >
                        {log.statusCode}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
                        {log.method}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-foreground font-mono truncate max-w-[200px] block">
                        {log.path}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-muted-foreground">
                        {log.responseTimeMs}ms
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDate(log.createdAt)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="btn-ghost !px-2 !py-1 text-xs"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * limit + 1}-
              {Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn-ghost !px-2 !py-1"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="btn-ghost !px-2 !py-1"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Detail Modal */}
      {selectedLog && (
        <WebhookLogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </motion.div>
  );
}

function WebhookLogDetailModal({
  log,
  onClose,
}: {
  log: WebhookLog;
  onClose: () => void;
}) {
  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "bg-success";
    if (status >= 400 && status < 500) return "bg-warning";
    return "bg-destructive";
  };

  const errorMessage = log.error;
  const requestBodyStr = log.requestBody ? JSON.stringify(log.requestBody, null, 2) : null;
  const responseBodyStr = log.responseBody ? JSON.stringify(log.responseBody, null, 2) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-card rounded-xl shadow-xl border border-border max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <div className={cn("h-2.5 w-2.5 rounded-full", getStatusColor(log.statusCode))} />
            <h3 className="font-semibold text-foreground">
              {log.method} {log.path}
            </h3>
          </div>
          <button onClick={onClose} className="btn-ghost !px-2 !py-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status Code</p>
              <p className="text-sm text-foreground font-medium">{log.statusCode}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Response Time</p>
              <p className="text-sm text-foreground font-medium">{log.responseTimeMs}ms</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Webhook ID</p>
              <p className="text-sm text-foreground font-mono">{log.webhookId}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">IP Address</p>
              <p className="text-sm text-foreground font-mono">{log.ipAddress ?? "N/A"}</p>
            </div>
          </div>

          {/* Error */}
          {errorMessage !== null && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Error</p>
              <div className="rounded-lg bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Request Headers */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Request Headers</p>
            <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto">
              {JSON.stringify(log.requestHeaders, null, 2)}
            </pre>
          </div>

          {/* Request Body */}
          {requestBodyStr !== null && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Request Body</p>
              <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto">
                {requestBodyStr}
              </pre>
            </div>
          )}

          {/* Response Body */}
          {responseBodyStr !== null && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Response Body</p>
              <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto">
                {responseBodyStr}
              </pre>
            </div>
          )}

          {/* User Agent */}
          {log.userAgent !== null && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">User Agent</p>
              <p className="text-xs text-muted-foreground break-all">{log.userAgent}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
