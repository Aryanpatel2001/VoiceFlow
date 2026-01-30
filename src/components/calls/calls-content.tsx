/**
 * Calls Content
 *
 * Client component for the calls history page.
 * Displays stats, filters, and paginated call list.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Loader2,
  PhoneOff,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration, formatPhoneNumber, getRelativeTime } from "@/lib/utils";

interface Call {
  id: string;
  organization_id: string;
  flow_id: string | null;
  direction: "inbound" | "outbound";
  caller_number: string;
  callee_number: string;
  status: string;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  primary_intent: string | null;
  sentiment_label: string | null;
  outcome: string | null;
  summary: string | null;
  transcript: string | null;
  cost_amount: number;
  created_at: string;
}

const PAGE_SIZE = 20;

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

export function CallsContent() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("started_at");
  const [sortOrder, setSortOrder] = useState<string>("desc");

  // Stats
  const [stats, setStats] = useState({
    totalCalls: 0,
    completedCalls: 0,
    missedCalls: 0,
    avgDuration: 0,
    totalDuration: 0,
  });

  const fetchCalls = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: (page * PAGE_SIZE).toString(),
        orderBy: sortBy,
        order: sortOrder,
      });

      if (statusFilter !== "all") params.set("status", statusFilter);
      if (directionFilter !== "all") params.set("direction", directionFilter);
      if (searchQuery) params.set("phoneNumber", searchQuery);

      const res = await fetch(`/api/calls?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch calls:", err);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, directionFilter, sortBy, sortOrder, searchQuery]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/calls/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Stats fetch failed, use defaults
    }
  }, []);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchCalls();
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(0);
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Call History</h1>
            <p className="text-sm text-muted-foreground">
              View and manage all voice agent calls.
            </p>
          </div>
          <Link href="/dashboard/test-call" className="btn-primary w-fit">
            <Phone className="h-4 w-4" />
            New Test Call
          </Link>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          label="Total Calls"
          value={stats.totalCalls.toLocaleString()}
          icon={Phone}
          color="text-primary"
          bgColor="bg-primary/10"
        />
        <StatCard
          label="Completed"
          value={stats.completedCalls.toLocaleString()}
          icon={CheckCircle2}
          color="text-success"
          bgColor="bg-success/10"
        />
        <StatCard
          label="Missed"
          value={stats.missedCalls.toLocaleString()}
          icon={PhoneMissed}
          color="text-warning"
          bgColor="bg-warning/10"
        />
        <StatCard
          label="Avg. Duration"
          value={stats.avgDuration > 0 ? formatDuration(Math.round(stats.avgDuration)) : "0s"}
          icon={Clock}
          color="text-info"
          bgColor="bg-info/10"
        />
      </motion.div>

      {/* Filters & Search */}
      <motion.div variants={itemVariants}>
        <div className="card-premium !p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <form onSubmit={handleSearch} className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by phone number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full !pl-10 !py-2"
              />
            </form>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Filters:</span>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
                className="!py-1.5 !px-3 text-xs"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="in_progress">In Progress</option>
                <option value="missed">Missed</option>
                <option value="failed">Failed</option>
              </select>

              <select
                value={directionFilter}
                onChange={(e) => {
                  setDirectionFilter(e.target.value);
                  setPage(0);
                }}
                className="!py-1.5 !px-3 text-xs"
              >
                <option value="all">All Directions</option>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Call List */}
      <motion.div variants={itemVariants}>
        <div className="card-premium !p-0 overflow-hidden">
          {/* Table Header */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-4 border-b border-border px-6 py-3 bg-muted/30">
            <div className="col-span-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Type
            </div>
            <div className="col-span-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Phone Number
            </div>
            <div className="col-span-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Status
            </div>
            <div
              className="col-span-2 flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground"
              onClick={() => toggleSort("duration_seconds")}
            >
              Duration
              <ArrowUpDown className="h-3 w-3" />
            </div>
            <div
              className="col-span-2 flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground"
              onClick={() => toggleSort("started_at")}
            >
              Time
              <ArrowUpDown className="h-3 w-3" />
            </div>
            <div className="col-span-2 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">
              Details
            </div>
          </div>

          {/* Loading */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading calls...</span>
            </div>
          ) : calls.length === 0 ? (
            <EmptyState hasFilters={statusFilter !== "all" || directionFilter !== "all" || !!searchQuery} />
          ) : (
            <div className="divide-y divide-border">
              {calls.map((call) => (
                <CallRow key={call.id} call={call} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-6 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total} calls
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                  if (pageNum >= totalPages) return null;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors",
                        pageNum === page
                          ? "bg-primary text-primary-foreground"
                          : "border border-border hover:bg-accent"
                      )}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function CallRow({ call }: { call: Call }) {
  const phoneNumber = call.direction === "inbound" ? call.caller_number : call.callee_number;
  const startedAt = new Date(call.started_at);

  return (
    <Link
      href={`/dashboard/calls/${call.id}`}
      className="group block hover:bg-accent/50 transition-colors"
    >
      {/* Desktop */}
      <div className="hidden sm:grid sm:grid-cols-12 gap-4 items-center px-6 py-3.5">
        {/* Direction Icon */}
        <div className="col-span-1">
          <DirectionIcon direction={call.direction} status={call.status} />
        </div>

        {/* Phone Number + Summary */}
        <div className="col-span-3 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {phoneNumber ? formatPhoneNumber(phoneNumber) : "Test Call"}
          </p>
          {call.summary && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {call.summary}
            </p>
          )}
        </div>

        {/* Status */}
        <div className="col-span-2">
          <StatusBadge status={call.status} />
        </div>

        {/* Duration */}
        <div className="col-span-2">
          <span className="text-sm text-foreground font-mono">
            {call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : "--:--"}
          </span>
        </div>

        {/* Time */}
        <div className="col-span-2">
          <p className="text-sm text-foreground">
            {startedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
          <p className="text-xs text-muted-foreground">
            {startedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
          </p>
        </div>

        {/* Actions */}
        <div className="col-span-2 flex justify-end">
          <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
            View
            <ExternalLink className="h-3 w-3" />
          </span>
        </div>
      </div>

      {/* Mobile */}
      <div className="sm:hidden flex items-center gap-3 px-4 py-3.5">
        <DirectionIcon direction={call.direction} status={call.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {phoneNumber ? formatPhoneNumber(phoneNumber) : "Test Call"}
            </span>
            <StatusBadge status={call.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : "--:--"}
            {" "}·{" "}
            {getRelativeTime(startedAt)}
          </p>
        </div>
        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </Link>
  );
}

function DirectionIcon({ direction, status }: { direction: string; status: string }) {
  const bgColor =
    status === "completed" ? "bg-success/10" :
    status === "missed" ? "bg-warning/10" :
    status === "failed" ? "bg-destructive/10" :
    status === "in_progress" ? "bg-info/10" :
    "bg-muted";

  if (status === "missed") {
    return (
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", bgColor)}>
        <PhoneMissed className="h-4 w-4 text-warning" />
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", bgColor)}>
        <PhoneOff className="h-4 w-4 text-destructive" />
      </div>
    );
  }

  const iconColor =
    status === "completed" ? "text-success" :
    status === "in_progress" ? "text-info" :
    "text-muted-foreground";

  return (
    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", bgColor)}>
      {direction === "inbound" ? (
        <PhoneIncoming className={cn("h-4 w-4", iconColor)} />
      ) : (
        <PhoneOutgoing className={cn("h-4 w-4", iconColor)} />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
    completed: { label: "Completed", className: "badge-success", icon: CheckCircle2 },
    in_progress: { label: "In Progress", className: "badge-info", icon: Phone },
    missed: { label: "Missed", className: "badge-warning", icon: AlertCircle },
    failed: { label: "Failed", className: "badge-error", icon: XCircle },
    initiated: { label: "Initiated", className: "badge-info", icon: Phone },
    ringing: { label: "Ringing", className: "badge-info", icon: Phone },
  };

  const { label, className, icon: Icon } = config[status] || config.initiated;

  return (
    <span className={className}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
}: {
  label: string;
  value: string;
  icon: typeof Phone;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="card-premium flex items-start justify-between">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </div>
      <div className={cn("rounded-lg p-2.5", bgColor)}>
        <Icon className={cn("h-5 w-5", color)} />
      </div>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
        <Phone className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        {hasFilters ? "No calls match your filters" : "No calls yet"}
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-xs mb-4">
        {hasFilters
          ? "Try adjusting your filters or search query."
          : "Start a test call to see your call history here."}
      </p>
      {!hasFilters && (
        <Link href="/dashboard/test-call" className="btn-primary">
          <Phone className="h-4 w-4" />
          Make a Test Call
        </Link>
      )}
    </div>
  );
}
