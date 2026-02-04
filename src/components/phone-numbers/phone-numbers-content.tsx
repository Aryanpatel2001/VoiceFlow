/**
 * Phone Numbers Content
 *
 * Client component for managing phone numbers.
 * Lists numbers, assign flows, add/remove numbers.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Phone,
  PhoneCall,
  Plus,
  Trash2,
  Settings2,
  Link2,
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  GitBranch,
  Globe,
  Copy,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PhoneNumber {
  id: string;
  organizationId: string;
  number: string;
  countryCode: string;
  provider: string;
  providerId: string | null;
  friendlyName: string | null;
  capabilities: { voice: boolean; sms: boolean };
  status: "active" | "inactive" | "pending";
  monthlyCost: number;
  assignedFlowId: string | null;
  assignedFlowName?: string;
  createdAt: string;
  updatedAt: string;
}

interface Flow {
  id: string;
  name: string;
  status: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export function PhoneNumbersContent() {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<string | null>(null);
  const [newNumber, setNewNumber] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchPhoneNumbers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/phone-numbers");
      const data = await res.json();
      setPhoneNumbers(data.numbers || []);
    } catch (error) {
      console.error("Failed to fetch phone numbers:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFlows = useCallback(async () => {
    try {
      const res = await fetch("/api/flows");
      const data = await res.json();
      setFlows(data.flows || []);
    } catch (error) {
      console.error("Failed to fetch flows:", error);
    }
  }, []);

  useEffect(() => {
    fetchPhoneNumbers();
    fetchFlows();
  }, [fetchPhoneNumbers, fetchFlows]);

  const handleAddNumber = async () => {
    if (!newNumber.trim()) return;

    try {
      setAdding(true);
      const res = await fetch("/api/phone-numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: newNumber,
          friendlyName: newName || undefined,
          mode: "manual",
        }),
      });

      if (res.ok) {
        setNewNumber("");
        setNewName("");
        setShowAddModal(false);
        fetchPhoneNumbers();
      }
    } catch (error) {
      console.error("Failed to add number:", error);
    } finally {
      setAdding(false);
    }
  };

  const handleAssignFlow = async (phoneNumberId: string, flowId: string | null) => {
    try {
      await fetch(`/api/phone-numbers/${phoneNumberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedFlowId: flowId }),
      });
      setShowAssignModal(null);
      fetchPhoneNumbers();
    } catch (error) {
      console.error("Failed to assign flow:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this phone number?")) return;

    try {
      await fetch(`/api/phone-numbers/${id}`, { method: "DELETE" });
      fetchPhoneNumbers();
    } catch (error) {
      console.error("Failed to delete number:", error);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      await fetch(`/api/phone-numbers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchPhoneNumbers();
    } catch (error) {
      console.error("Failed to toggle status:", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const activeCount = phoneNumbers.filter((p) => p.status === "active").length;
  const assignedCount = phoneNumbers.filter((p) => p.assignedFlowId).length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Phone Numbers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage phone numbers and assign voice agents to handle calls.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Number
        </button>
      </div>

      {/* Stats */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-3"
      >
        <motion.div
          variants={itemVariants}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Numbers</p>
              <p className="text-2xl font-bold text-foreground">{phoneNumbers.length}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-500/10 p-2.5">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-foreground">{activeCount}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2.5">
              <GitBranch className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">With Agent</p>
              <p className="text-2xl font-bold text-foreground">{assignedCount}</p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Phone Numbers List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : phoneNumbers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <PhoneCall className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">No phone numbers</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Add a phone number to start receiving voice calls with your AI agents.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Your First Number
          </button>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          {phoneNumbers.map((phone) => (
            <motion.div
              key={phone.id}
              variants={itemVariants}
              className="rounded-xl border border-border bg-card p-5 hover:border-border/80 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Status indicator */}
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full",
                      phone.status === "active"
                        ? "bg-green-500/10"
                        : "bg-muted"
                    )}
                  >
                    <Phone
                      className={cn(
                        "h-5 w-5",
                        phone.status === "active"
                          ? "text-green-500"
                          : "text-muted-foreground"
                      )}
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-foreground">
                        {formatPhoneDisplay(phone.number)}
                      </span>
                      <button
                        onClick={() => copyToClipboard(phone.number)}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="Copy number"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          phone.status === "active"
                            ? "bg-green-500/10 text-green-500"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {phone.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                      {phone.friendlyName && (
                        <span>{phone.friendlyName}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5" />
                        {phone.provider}
                      </span>
                      {phone.capabilities.voice && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">Voice</span>
                      )}
                      {phone.capabilities.sms && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">SMS</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Assigned flow */}
                  <div className="text-right">
                    {phone.assignedFlowId ? (
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {phone.assignedFlowName || "Flow assigned"}
                          </p>
                          <p className="text-xs text-muted-foreground">Agent active</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No agent assigned</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setShowAssignModal(phone.id)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Assign flow"
                    >
                      <Link2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(phone.id, phone.status)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title={phone.status === "active" ? "Deactivate" : "Activate"}
                    >
                      {phone.status === "active" ? (
                        <XCircle className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(phone.id)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Add Number Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-foreground">Add Phone Number</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a phone number to receive calls. Use Twilio for production numbers.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">
                  Friendly Name (optional)
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Main Office Line"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  For production use, configure <strong>TWILIO_ACCOUNT_SID</strong> and{" "}
                  <strong>TWILIO_AUTH_TOKEN</strong> in your environment to purchase numbers from Twilio.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNumber}
                disabled={adding || !newNumber.trim()}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {adding && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Number
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Assign Flow Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-foreground">Assign Voice Agent</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a published flow to handle calls on this number.
            </p>

            <div className="mt-6 space-y-2">
              {/* Unassign option */}
              <button
                onClick={() => handleAssignFlow(showAssignModal, null)}
                className="w-full rounded-lg border border-border p-3 text-left hover:bg-muted transition-colors"
              >
                <p className="text-sm font-medium text-foreground">No Agent</p>
                <p className="text-xs text-muted-foreground">Remove flow assignment</p>
              </button>

              {flows.length === 0 ? (
                <div className="rounded-lg bg-muted/50 p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    No flows available. Create and publish a flow in Agent Canvas first.
                  </p>
                </div>
              ) : (
                flows.map((flow) => (
                  <button
                    key={flow.id}
                    onClick={() => handleAssignFlow(showAssignModal, flow.id)}
                    className="w-full rounded-lg border border-border p-3 text-left hover:bg-muted hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{flow.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Status: {flow.status}
                        </p>
                      </div>
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowAssignModal(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function formatPhoneDisplay(number: string): string {
  // Format +1XXXXXXXXXX to +1 (XXX) XXX-XXXX
  if (number.startsWith("+1") && number.length === 12) {
    const area = number.slice(2, 5);
    const prefix = number.slice(5, 8);
    const line = number.slice(8);
    return `+1 (${area}) ${prefix}-${line}`;
  }
  return number;
}
