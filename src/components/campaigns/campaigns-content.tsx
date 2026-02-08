"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Megaphone,
  Plus,
  Search,
  Play,
  Pause,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical,
  Trash2,
  Edit,
  Loader2,
  Phone,
  TrendingUp,
} from "lucide-react";

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

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  flow_id: string | null;
  flow_name?: string;
  status: "draft" | "scheduled" | "running" | "paused" | "completed";
  total_contacts: number;
  completed_contacts: number;
  successful_contacts: number;
  timezone: string;
  allowed_hours_start: string;
  allowed_hours_end: string;
  allowed_days: number[];
  created_at: string;
  updated_at: string;
}

interface CampaignStats {
  total: number;
  running: number;
  completed: number;
  totalContacts: number;
}

export function CampaignsContent() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<CampaignStats>({
    total: 0,
    running: 0,
    completed: 0,
    totalContacts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/campaigns?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);

        // Calculate stats
        const all = data.campaigns || [];
        setStats({
          total: all.length,
          running: all.filter((c: Campaign) => c.status === "running").length,
          completed: all.filter((c: Campaign) => c.status === "completed").length,
          totalContacts: all.reduce(
            (sum: number, c: Campaign) => sum + c.total_contacts,
            0
          ),
        });
      }
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleStart = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/campaigns/${id}/start`, { method: "POST" });
      if (res.ok) {
        fetchCampaigns();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to start campaign");
      }
    } catch (error) {
      console.error("Failed to start campaign:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePause = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/campaigns/${id}/pause`, { method: "POST" });
      if (res.ok) {
        fetchCampaigns();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to pause campaign");
      }
    } catch (error) {
      console.error("Failed to pause campaign:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;

    setActionLoading(id);
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchCampaigns();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete campaign");
      }
    } catch (error) {
      console.error("Failed to delete campaign:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredCampaigns = campaigns.filter((campaign) =>
    campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: Campaign["status"]) => {
    const styles: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      scheduled: "bg-blue-500/10 text-blue-500",
      running: "bg-green-500/10 text-green-500",
      paused: "bg-yellow-500/10 text-yellow-500",
      completed: "bg-primary/10 text-primary",
    };
    return styles[status] || styles.draft;
  };

  const getProgressPercent = (campaign: Campaign) => {
    if (campaign.total_contacts === 0) return 0;
    return Math.round(
      (campaign.completed_contacts / campaign.total_contacts) * 100
    );
  };

  const getSuccessRate = (campaign: Campaign) => {
    if (campaign.completed_contacts === 0) return 0;
    return Math.round(
      (campaign.successful_contacts / campaign.completed_contacts) * 100
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage outbound calling campaigns
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Campaign
        </button>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 gap-4 sm:grid-cols-4"
      >
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-xl font-semibold">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-500/10 p-2">
              <Play className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Running</p>
              <p className="text-xl font-semibold">{stats.running}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <CheckCircle2 className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-xl font-semibold">{stats.completed}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-500/10 p-2">
              <Users className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Contacts</p>
              <p className="text-xl font-semibold">
                {stats.totalContacts.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col gap-4 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="running">Running</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
        </select>
      </motion.div>

      {/* Campaign List */}
      <motion.div variants={itemVariants} className="space-y-4">
        {filteredCampaigns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <Megaphone className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No campaigns yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first campaign to start reaching out to contacts.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Create Campaign
            </button>
          </div>
        ) : (
          filteredCampaigns.map((campaign) => (
            <motion.div
              key={campaign.id}
              variants={itemVariants}
              className="rounded-xl border border-border bg-card p-5 hover:border-border/80 transition-colors cursor-pointer"
              onClick={() => router.push(`/dashboard/campaigns/${campaign.id}`)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold truncate">
                      {campaign.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadge(campaign.status)}`}
                    >
                      {campaign.status}
                    </span>
                  </div>
                  {campaign.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                      {campaign.description}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    {campaign.flow_name && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {campaign.flow_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {campaign.total_contacts.toLocaleString()} contacts
                    </span>
                    {campaign.completed_contacts > 0 && (
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {getSuccessRate(campaign)}% success
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress */}
                <div className="hidden sm:flex flex-col items-end gap-2 min-w-[120px]">
                  <div className="text-sm font-medium">
                    {getProgressPercent(campaign)}% complete
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${getProgressPercent(campaign)}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {campaign.completed_contacts} / {campaign.total_contacts}
                  </div>
                </div>

                {/* Actions */}
                <div
                  className="flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {campaign.status === "running" ? (
                    <button
                      onClick={() => handlePause(campaign.id)}
                      disabled={actionLoading === campaign.id}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                      title="Pause"
                    >
                      {actionLoading === campaign.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Pause className="h-4 w-4" />
                      )}
                    </button>
                  ) : (
                    campaign.status !== "completed" && (
                      <button
                        onClick={() => handleStart(campaign.id)}
                        disabled={actionLoading === campaign.id}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                        title="Start"
                      >
                        {actionLoading === campaign.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => handleDelete(campaign.id)}
                    disabled={
                      actionLoading === campaign.id ||
                      campaign.status === "running"
                    }
                    className="p-2 rounded-lg hover:bg-muted transition-colors text-destructive disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </motion.div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <CreateCampaignModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchCampaigns();
          }}
        />
      )}
    </motion.div>
  );
}

// Inline Create Campaign Modal
function CreateCampaignModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [flowId, setFlowId] = useState("");
  const [flows, setFlows] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFlows, setLoadingFlows] = useState(true);

  useEffect(() => {
    async function fetchFlows() {
      try {
        const res = await fetch("/api/flows?status=published");
        if (res.ok) {
          const data = await res.json();
          setFlows(data.flows || []);
        }
      } catch (error) {
        console.error("Failed to fetch flows:", error);
      } finally {
        setLoadingFlows(false);
      }
    }
    fetchFlows();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          flowId: flowId || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/dashboard/campaigns/${data.campaign.id}`);
        onCreated();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create campaign");
      }
    } catch (error) {
      console.error("Failed to create campaign:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold">Create Campaign</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up a new outbound calling campaign
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Campaign Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q1 Outreach"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Voice Agent Flow
            </label>
            {loadingFlows ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading flows...
              </div>
            ) : flows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No published flows available.{" "}
                <a
                  href="/dashboard/canvas"
                  className="text-primary hover:underline"
                >
                  Create one
                </a>
              </p>
            ) : (
              <select
                value={flowId}
                onChange={(e) => setFlowId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">Select a flow...</option>
                {flows.map((flow) => (
                  <option key={flow.id} value={flow.id}>
                    {flow.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Campaign
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
