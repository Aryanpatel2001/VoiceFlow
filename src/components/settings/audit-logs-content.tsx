/**
 * Audit Logs Content
 *
 * Client component displaying audit logs with filters.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  User,
  Clock,
  FileText,
  Eye,
  X,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditLog {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

interface FilterOptions {
  actions: string[];
  entityTypes: string[];
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

const actionLabels: Record<string, { label: string; color: string }> = {
  create: { label: "Created", color: "bg-success" },
  update: { label: "Updated", color: "bg-info" },
  delete: { label: "Deleted", color: "bg-destructive" },
  login: { label: "Login", color: "bg-primary" },
  logout: { label: "Logout", color: "bg-muted-foreground" },
  publish: { label: "Published", color: "bg-success" },
  unpublish: { label: "Unpublished", color: "bg-warning" },
  start: { label: "Started", color: "bg-info" },
  stop: { label: "Stopped", color: "bg-warning" },
  pause: { label: "Paused", color: "bg-warning" },
  resume: { label: "Resumed", color: "bg-success" },
};

export function AuditLogsContent() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    actions: [],
    entityTypes: [],
  });

  // Filters
  const [selectedAction, setSelectedAction] = useState<string>("");
  const [selectedEntityType, setSelectedEntityType] = useState<string>("");

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 20;

  // Detail modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Fetch filter options
  useEffect(() => {
    async function fetchFilters() {
      try {
        const res = await fetch("/api/audit-logs?filters=true");
        if (res.ok) {
          const data = await res.json();
          setFilterOptions(data);
        }
      } catch {
        // Ignore filter fetch errors
      }
    }
    fetchFilters();
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

      if (selectedAction) params.set("action", selectedAction);
      if (selectedEntityType) params.set("entityType", selectedEntityType);

      const res = await fetch(`/api/audit-logs?${params}`);
      if (!res.ok) {
        throw new Error("Failed to fetch audit logs");
      }

      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    } catch {
      setError("Failed to load audit logs");
    } finally {
      setIsLoading(false);
    }
  }, [page, selectedAction, selectedEntityType]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getActionConfig = (action: string) => {
    return actionLabels[action.toLowerCase()] || { label: action, color: "bg-muted" };
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
          <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track all activity in your organization
          </p>
        </div>

        <button className="btn-secondary">
          <Download className="h-4 w-4" />
          Export
        </button>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex flex-wrap gap-3">
        {/* Action Filter */}
        <select
          value={selectedAction}
          onChange={(e) => {
            setSelectedAction(e.target.value);
            setPage(1);
          }}
          className="input-field !w-auto min-w-[150px]"
        >
          <option value="">All Actions</option>
          {filterOptions.actions.map((action) => (
            <option key={action} value={action}>
              {getActionConfig(action).label}
            </option>
          ))}
        </select>

        {/* Entity Type Filter */}
        <select
          value={selectedEntityType}
          onChange={(e) => {
            setSelectedEntityType(e.target.value);
            setPage(1);
          }}
          className="input-field !w-auto min-w-[150px]"
        >
          <option value="">All Types</option>
          {filterOptions.entityTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        {/* Clear Filters */}
        {(selectedAction || selectedEntityType) && (
          <button
            onClick={() => {
              setSelectedAction("");
              setSelectedEntityType("");
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
            <Shield className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No audit logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">
                    Action
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">
                    User
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">
                    Entity
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
                {logs.map((log, index) => {
                  const actionConfig = getActionConfig(log.action);
                  return (
                    <tr
                      key={log.id}
                      className={cn(
                        "border-b border-border/50 transition-colors hover:bg-muted/50",
                        index === logs.length - 1 && "border-b-0"
                      )}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "h-2 w-2 rounded-full",
                              actionConfig.color
                            )}
                          />
                          <span className="text-sm font-medium text-foreground">
                            {actionConfig.label}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm text-foreground">
                              {log.user_name || "System"}
                            </p>
                            {log.user_email && (
                              <p className="text-xs text-muted-foreground">
                                {log.user_email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {log.entity_type ? (
                          <div>
                            <p className="text-sm text-foreground capitalize">
                              {log.entity_type}
                            </p>
                            {log.entity_id && (
                              <p className="text-xs text-muted-foreground font-mono">
                                {log.entity_id.slice(0, 8)}...
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(log.created_at)}
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
                  );
                })}
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
        <AuditLogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </motion.div>
  );
}

function AuditLogDetailModal({
  log,
  onClose,
}: {
  log: AuditLog;
  onClose: () => void;
}) {
  const actionConfig = actionLabels[log.action.toLowerCase()] || {
    label: log.action,
    color: "bg-muted",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-card rounded-xl shadow-xl border border-border">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <div className={cn("h-2.5 w-2.5 rounded-full", actionConfig.color)} />
            <h3 className="font-semibold text-foreground">{actionConfig.label}</h3>
          </div>
          <button onClick={onClose} className="btn-ghost !px-2 !py-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">User</p>
              <p className="text-sm text-foreground">
                {log.user_name || "System"}
              </p>
              {log.user_email && (
                <p className="text-xs text-muted-foreground">{log.user_email}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Time</p>
              <p className="text-sm text-foreground">
                {new Date(log.created_at).toLocaleString()}
              </p>
            </div>
            {log.entity_type && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Entity Type</p>
                <p className="text-sm text-foreground capitalize">
                  {log.entity_type}
                </p>
              </div>
            )}
            {log.entity_id && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Entity ID</p>
                <p className="text-sm text-foreground font-mono text-xs">
                  {log.entity_id}
                </p>
              </div>
            )}
            {log.ip_address && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">IP Address</p>
                <p className="text-sm text-foreground font-mono">
                  {log.ip_address}
                </p>
              </div>
            )}
          </div>

          {/* Changes */}
          {(log.old_values || log.new_values) && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Changes</p>
              <div className="rounded-lg bg-muted p-3 space-y-2">
                {log.old_values && (
                  <div>
                    <p className="text-xs font-medium text-destructive mb-1">
                      Previous Values
                    </p>
                    <pre className="text-xs text-muted-foreground overflow-x-auto">
                      {JSON.stringify(log.old_values, null, 2)}
                    </pre>
                  </div>
                )}
                {log.new_values && (
                  <div>
                    <p className="text-xs font-medium text-success mb-1">
                      New Values
                    </p>
                    <pre className="text-xs text-muted-foreground overflow-x-auto">
                      {JSON.stringify(log.new_values, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* User Agent */}
          {log.user_agent && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">User Agent</p>
              <p className="text-xs text-muted-foreground break-all">
                {log.user_agent}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
