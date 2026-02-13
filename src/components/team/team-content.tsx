/**
 * Team Content
 *
 * Team member management interface.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users,
  UserPlus,
  Shield,
  Crown,
  MoreVertical,
  Trash2,
  Edit3,
  Mail,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: "owner" | "admin" | "member";
  joinedAt: string;
  lastLoginAt: string | null;
}

interface TeamStats {
  totalMembers: number;
  admins: number;
  members: number;
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

export function TeamContent() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  // Actions
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/team");
      if (!res.ok) throw new Error("Failed to fetch team");
      const data = await res.json();
      setMembers(data.members);
      setStats(data.stats);
    } catch {
      setError("Failed to load team members");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="h-4 w-4 text-warning" />;
      case "admin":
        return <Shield className="h-4 w-4 text-primary" />;
      default:
        return <Users className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRoleBadge = (role: string) => {
    const styles = {
      owner: "bg-warning/10 text-warning",
      admin: "bg-primary/10 text-primary",
      member: "bg-muted text-muted-foreground",
    };
    return styles[role as keyof typeof styles] || styles.member;
  };

  const getInitials = (member: TeamMember) => {
    if (member.firstName && member.lastName) {
      return `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();
    }
    return member.email[0].toUpperCase();
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this team member?")) return;

    try {
      const res = await fetch(`/api/team/${memberId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove member");
      }
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setActionMenuId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const handleUpdateRole = async (memberId: string, role: string) => {
    try {
      const res = await fetch(`/api/team/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update role");
      }
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: role as TeamMember["role"] } : m))
      );
      setShowEditModal(false);
      setSelectedMember(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">{error}</h2>
        <button onClick={fetchTeam} className="btn-secondary mt-4">
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
          <h1 className="text-2xl font-bold text-foreground">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your organization&apos;s team members
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="btn-primary"
        >
          <UserPlus className="h-4 w-4" />
          Invite Member
        </button>
      </motion.div>

      {/* Stats */}
      {stats && (
        <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4">
          <div className="card-premium p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Users className="h-4 w-4" />
              <span className="text-xs">Total Members</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {stats.totalMembers}
            </p>
          </div>
          <div className="card-premium p-4">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Shield className="h-4 w-4" />
              <span className="text-xs">Admins</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.admins}</p>
          </div>
          <div className="card-premium p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Users className="h-4 w-4" />
              <span className="text-xs">Members</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.members}</p>
          </div>
        </motion.div>
      )}

      {/* Members List */}
      <motion.div variants={itemVariants} className="card-premium !p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading...</span>
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Users className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No team members yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                      {getInitials(member)}
                    </div>
                  )}

                  {/* Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">
                        {member.firstName && member.lastName
                          ? `${member.firstName} ${member.lastName}`
                          : member.email}
                      </p>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                          getRoleBadge(member.role)
                        )}
                      >
                        {getRoleIcon(member.role)}
                        {member.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {member.email}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Joined {formatDate(member.joinedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {member.role !== "owner" && (
                  <div className="relative">
                    <button
                      onClick={() =>
                        setActionMenuId(actionMenuId === member.id ? null : member.id)
                      }
                      className="btn-ghost !px-2 !py-2"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {actionMenuId === member.id && (
                      <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-border bg-card shadow-lg z-10">
                        <button
                          onClick={() => {
                            setSelectedMember(member);
                            setShowEditModal(true);
                            setActionMenuId(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                        >
                          <Edit3 className="h-4 w-4" />
                          Change Role
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false);
            fetchTeam();
          }}
        />
      )}

      {/* Edit Role Modal */}
      {showEditModal && selectedMember && (
        <EditRoleModal
          member={selectedMember}
          onClose={() => {
            setShowEditModal(false);
            setSelectedMember(null);
          }}
          onSave={(role) => handleUpdateRole(selectedMember.id, role)}
        />
      )}
    </motion.div>
  );
}

function InviteModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite member");

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-card rounded-xl shadow-xl border border-border">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="font-semibold text-foreground">Invite Team Member</h3>
          <button onClick={onClose} className="btn-ghost !px-2 !py-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "member")}
              className="input-field"
            >
              <option value="member">Member - Can view and create flows</option>
              <option value="admin">Admin - Full access including team management</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading || !email.trim()} className="btn-primary">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditRoleModal({
  member,
  onClose,
  onSave,
}: {
  member: TeamMember;
  onClose: () => void;
  onSave: (role: string) => void;
}) {
  const [role, setRole] = useState(member.role);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave(role);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-card rounded-xl shadow-xl border border-border">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="font-semibold text-foreground">Change Role</h3>
          <button onClick={onClose} className="btn-ghost !px-2 !py-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Change role for <strong>{member.email}</strong>
          </p>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as TeamMember["role"])}
              className="input-field"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading || role === member.role} className="btn-primary">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
