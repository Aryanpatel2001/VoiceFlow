/**
 * Version History Component
 *
 * Displays flow version history with rollback functionality.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  History,
  ChevronRight,
  RotateCcw,
  Eye,
  Clock,
  User,
  Check,
  X,
  Loader2,
  AlertCircle,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FlowVersion {
  id: string;
  flowId: string;
  versionNumber: number;
  flowData: {
    nodes: unknown[];
    edges: unknown[];
    variables: unknown[];
    settings: unknown;
  };
  publishedAt: string;
  publishedBy: string;
}

interface VersionHistoryProps {
  flowId: string;
  currentVersion?: number;
  onRollback?: (version: FlowVersion) => void;
  onPreview?: (version: FlowVersion) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function VersionHistory({
  flowId,
  currentVersion,
  onRollback,
  onPreview,
  isOpen,
  onClose,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<FlowVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<FlowVersion | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [confirmRollback, setConfirmRollback] = useState<number | null>(null);

  const fetchVersions = useCallback(async () => {
    if (!flowId) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/flows/${flowId}/versions`);
      if (!res.ok) throw new Error("Failed to fetch versions");

      const data = await res.json();
      setVersions(data.versions || []);
    } catch (err) {
      setError("Failed to load version history");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [flowId]);

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
    }
  }, [isOpen, fetchVersions]);

  const handleRollback = async (version: FlowVersion) => {
    setIsRollingBack(true);

    try {
      const res = await fetch(`/api/flows/${flowId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionNumber: version.versionNumber }),
      });

      if (!res.ok) throw new Error("Failed to rollback");

      const data = await res.json();
      onRollback?.(version);
      setConfirmRollback(null);

      // Refresh versions
      fetchVersions();
    } catch (err) {
      setError("Failed to rollback to version");
      console.error(err);
    } finally {
      setIsRollingBack(false);
    }
  };

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

  const getVersionStats = (version: FlowVersion) => {
    const nodes = Array.isArray(version.flowData.nodes)
      ? version.flowData.nodes.length
      : 0;
    const edges = Array.isArray(version.flowData.edges)
      ? version.flowData.edges.length
      : 0;
    return { nodes, edges };
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex justify-end"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Panel */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="relative w-full max-w-md bg-card border-l border-border shadow-xl h-full overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <History className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Version History</h2>
                <p className="text-xs text-muted-foreground">
                  {versions.length} version{versions.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Loading versions...
                </p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <p className="mt-3 text-sm text-muted-foreground">{error}</p>
                <button
                  onClick={fetchVersions}
                  className="mt-4 text-sm text-primary hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <GitBranch className="h-8 w-8 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No versions published yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Publish your flow to create a version
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {versions.map((version, index) => {
                  const stats = getVersionStats(version);
                  const isCurrent = version.versionNumber === currentVersion;
                  const isConfirming = confirmRollback === version.versionNumber;

                  return (
                    <motion.div
                      key={version.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "rounded-lg border p-4 transition-all",
                        isCurrent
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                              isCurrent
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {version.versionNumber}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">
                                Version {version.versionNumber}
                              </span>
                              {isCurrent && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                  Current
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDate(version.publishedAt)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{stats.nodes} nodes</span>
                        <span>{stats.edges} connections</span>
                      </div>

                      {/* Actions */}
                      {!isCurrent && (
                        <div className="mt-3 flex items-center gap-2">
                          {isConfirming ? (
                            <div className="flex items-center gap-2 w-full">
                              <span className="text-xs text-muted-foreground">
                                Rollback to this version?
                              </span>
                              <button
                                onClick={() => handleRollback(version)}
                                disabled={isRollingBack}
                                className="btn-primary !px-2 !py-1 text-xs"
                              >
                                {isRollingBack ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3 w-3" />
                                )}
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmRollback(null)}
                                className="btn-ghost !px-2 !py-1 text-xs"
                              >
                                <X className="h-3 w-3" />
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedVersion(version);
                                  onPreview?.(version);
                                }}
                                className="btn-ghost !px-2 !py-1 text-xs"
                              >
                                <Eye className="h-3 w-3" />
                                Preview
                              </button>
                              <button
                                onClick={() => setConfirmRollback(version.versionNumber)}
                                className="btn-secondary !px-2 !py-1 text-xs"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Rollback
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
