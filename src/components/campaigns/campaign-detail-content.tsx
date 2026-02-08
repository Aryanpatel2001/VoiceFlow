"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Megaphone,
  Play,
  Pause,
  Upload,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Settings,
  Trash2,
  Download,
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
  scheduled_start: string | null;
  scheduled_end: string | null;
  allowed_hours_start: string;
  allowed_hours_end: string;
  allowed_days: number[];
  timezone: string;
  max_attempts: number;
  retry_interval_hours: number;
  concurrent_calls: number;
  total_contacts: number;
  completed_contacts: number;
  successful_contacts: number;
  created_at: string;
  updated_at: string;
}

interface CampaignStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  dnc: number;
  successRate: number;
}

interface Contact {
  id: string;
  phone_number: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: "pending" | "in_progress" | "completed" | "failed" | "dnc";
  attempts: number;
  last_attempt_at: string | null;
  call_id: string | null;
  created_at: string;
}

const PAGE_SIZE = 20;

export function CampaignDetailContent({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsTotal, setContactsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showUploadModal, setShowUploadModal] = useState(false);

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`);
      if (res.ok) {
        const data = await res.json();
        setCampaign(data.campaign);
        setStats(data.stats);
      } else if (res.status === 404) {
        router.push("/dashboard/campaigns");
      }
    } catch (error) {
      console.error("Failed to fetch campaign:", error);
    } finally {
      setLoading(false);
    }
  }, [campaignId, router]);

  const fetchContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: (page * PAGE_SIZE).toString(),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/campaigns/${campaignId}/contacts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
        setContactsTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch contacts:", error);
    } finally {
      setContactsLoading(false);
    }
  }, [campaignId, page, statusFilter, searchQuery]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  useEffect(() => {
    if (campaign) {
      fetchContacts();
    }
  }, [campaign, fetchContacts]);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/start`, {
        method: "POST",
      });
      if (res.ok) {
        fetchCampaign();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to start campaign");
      }
    } catch (error) {
      console.error("Failed to start:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/pause`, {
        method: "POST",
      });
      if (res.ok) {
        fetchCampaign();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to pause campaign");
      }
    } catch (error) {
      console.error("Failed to pause:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/dashboard/campaigns");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete campaign");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      scheduled: "bg-blue-500/10 text-blue-500",
      running: "bg-green-500/10 text-green-500",
      paused: "bg-yellow-500/10 text-yellow-500",
      completed: "bg-primary/10 text-primary",
      pending: "bg-muted text-muted-foreground",
      in_progress: "bg-blue-500/10 text-blue-500",
      failed: "bg-red-500/10 text-red-500",
      dnc: "bg-orange-500/10 text-orange-500",
    };
    return styles[status] || styles.draft;
  };

  const formatSchedule = () => {
    if (!campaign) return "";
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days = campaign.allowed_days
      .map((d) => dayNames[d === 7 ? 0 : d])
      .join(", ");
    return `${days}, ${campaign.allowed_hours_start} - ${campaign.allowed_hours_end} ${campaign.timezone}`;
  };

  const totalPages = Math.ceil(contactsTotal / PAGE_SIZE);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Campaign not found</p>
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
      <motion.div variants={itemVariants}>
        <Link
          href="/dashboard/campaigns"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3">
              <Megaphone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{campaign.name}</h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadge(campaign.status)}`}
                >
                  {campaign.status}
                </span>
              </div>
              {campaign.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {campaign.description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {campaign.flow_name && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {campaign.flow_name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatSchedule()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <Upload className="h-4 w-4" />
              Upload Contacts
            </button>
            {campaign.status === "running" ? (
              <button
                onClick={handlePause}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
                Pause
              </button>
            ) : campaign.status !== "completed" ? (
              <button
                onClick={handleStart}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Start
              </button>
            ) : null}
            {campaign.status !== "running" && (
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="p-2 rounded-lg text-destructive hover:bg-muted transition-colors"
                title="Delete Campaign"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      {stats && (
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
        >
          <StatCard
            label="Total"
            value={stats.total}
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label="Pending"
            value={stats.pending}
            icon={<Clock className="h-4 w-4" />}
            color="text-muted-foreground"
          />
          <StatCard
            label="In Progress"
            value={stats.inProgress}
            icon={<Phone className="h-4 w-4" />}
            color="text-blue-500"
          />
          <StatCard
            label="Completed"
            value={stats.completed}
            icon={<CheckCircle2 className="h-4 w-4" />}
            color="text-green-500"
          />
          <StatCard
            label="Failed"
            value={stats.failed}
            icon={<XCircle className="h-4 w-4" />}
            color="text-red-500"
          />
          <StatCard
            label="Success Rate"
            value={`${stats.successRate}%`}
            icon={<CheckCircle2 className="h-4 w-4" />}
            color="text-primary"
          />
        </motion.div>
      )}

      {/* Progress Bar */}
      <motion.div variants={itemVariants} className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Campaign Progress</span>
          <span className="text-sm text-muted-foreground">
            {campaign.completed_contacts} / {campaign.total_contacts} contacts
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{
              width: `${campaign.total_contacts > 0 ? (campaign.completed_contacts / campaign.total_contacts) * 100 : 0}%`,
            }}
          />
        </div>
      </motion.div>

      {/* Contacts Table */}
      <motion.div variants={itemVariants} className="rounded-xl border border-border bg-card">
        <div className="p-4 border-b border-border">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">Contacts</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(0);
                  }}
                  className="w-48 rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="dnc">DNC</option>
              </select>
            </div>
          </div>
        </div>

        {contactsLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No contacts yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload contacts to start your campaign.
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Upload className="h-4 w-4" />
              Upload Contacts
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-sm">
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Attempts</th>
                    <th className="px-4 py-3 font-medium">Last Attempt</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="border-b border-border hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 text-sm font-mono">
                        {contact.phone_number}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {contact.first_name || contact.last_name
                          ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim()
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadge(contact.status)}`}
                        >
                          {contact.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{contact.attempts}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {contact.last_attempt_at
                          ? new Date(contact.last_attempt_at).toLocaleString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1}-
                  {Math.min((page + 1) * PAGE_SIZE, contactsTotal)} of{" "}
                  {contactsTotal}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 0}
                    className="p-1 rounded hover:bg-muted disabled:opacity-50"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="text-sm">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages - 1}
                    className="p-1 rounded hover:bg-muted disabled:opacity-50"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Upload Modal */}
      {showUploadModal && (
        <ContactUploadModal
          campaignId={campaignId}
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => {
            setShowUploadModal(false);
            fetchCampaign();
            fetchContacts();
          }}
        />
      )}
    </motion.div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color = "text-foreground",
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={`text-xl font-semibold ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function ContactUploadModal({
  campaignId,
  onClose,
  onUploaded,
}: {
  campaignId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    added: number;
    errors: Array<{ row: number; message: string }>;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/campaigns/${campaignId}/contacts`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ added: data.added, errors: data.errors || [] });
        if (data.added > 0) {
          setTimeout(() => onUploaded(), 1500);
        }
      } else {
        alert(data.error || "Upload failed");
      }
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold">Upload Contacts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CSV file with contact information
        </p>

        <div className="mt-6 space-y-4">
          {/* Format Guide */}
          <div className="rounded-lg bg-muted/50 p-4 text-sm">
            <p className="font-medium mb-2">CSV Format:</p>
            <code className="text-xs">
              phone_number,first_name,last_name,email
            </code>
            <p className="mt-2 text-muted-foreground text-xs">
              <strong>Required:</strong> phone_number
              <br />
              <strong>Optional:</strong> first_name, last_name, email, any custom
              fields
            </p>
          </div>

          {/* File Input */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            {file ? (
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                <button
                  onClick={() => {
                    setFile(null);
                    setResult(null);
                  }}
                  className="mt-2 text-sm text-primary hover:underline"
                >
                  Choose different file
                </button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm">
                  <span className="text-primary">Click to upload</span> or drag
                  and drop
                </p>
                <p className="text-xs text-muted-foreground">CSV files only</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Result */}
          {result && (
            <div
              className={`rounded-lg p-4 ${result.added > 0 ? "bg-green-500/10" : "bg-red-500/10"}`}
            >
              <p className="font-medium">
                {result.added > 0 ? (
                  <span className="text-green-600">
                    Successfully added {result.added} contacts
                  </span>
                ) : (
                  <span className="text-red-600">No contacts were added</span>
                )}
              </p>
              {result.errors.length > 0 && (
                <div className="mt-2 text-sm text-muted-foreground max-h-32 overflow-y-auto">
                  <p className="font-medium text-red-600 mb-1">
                    {result.errors.length} errors:
                  </p>
                  {result.errors.slice(0, 5).map((err, i) => (
                    <p key={i}>
                      Row {err.row}: {err.message}
                    </p>
                  ))}
                  {result.errors.length > 5 && (
                    <p>...and {result.errors.length - 5} more</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
          >
            {result?.added ? "Done" : "Cancel"}
          </button>
          {!result?.added && (
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Upload
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
