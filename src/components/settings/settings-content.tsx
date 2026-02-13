/**
 * Settings Content
 *
 * User and organization settings interface.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  User,
  Building2,
  Bell,
  Shield,
  Key,
  Globe,
  Palette,
  Save,
  Loader2,
  ChevronRight,
  FileText,
  AlertCircle,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

type SettingsTab = "profile" | "organization" | "notifications" | "security";

export function SettingsContent() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [saving, setSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Profile state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  // Organization state
  const [orgName, setOrgName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [industry, setIndustry] = useState("");

  // Notification state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [callAlerts, setCallAlerts] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(true);

  // Fetch all settings on mount
  useEffect(() => {
    async function fetchSettings() {
      setIsLoading(true);
      try {
        const [profileRes, orgRes, notifRes] = await Promise.all([
          fetch("/api/settings/profile"),
          fetch("/api/settings/organization"),
          fetch("/api/settings/notifications"),
        ]);

        if (profileRes.ok) {
          const data = await profileRes.json();
          setFirstName(data.profile.firstName || "");
          setLastName(data.profile.lastName || "");
          setEmail(data.profile.email || "");
        }

        if (orgRes.ok) {
          const data = await orgRes.json();
          setOrgName(data.settings.name || "");
          setTimezone(data.settings.timezone || "America/New_York");
          setIndustry(data.settings.industry || "");
        }

        if (notifRes.ok) {
          const data = await notifRes.json();
          setEmailNotifications(data.preferences.emailNotifications ?? true);
          setCallAlerts(data.preferences.callAlerts ?? true);
          setWeeklyReport(data.preferences.weeklyReport ?? true);
        }
      } catch {
        setError("Failed to load settings");
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      showSuccess("Profile saved successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOrganization = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName, timezone, industry }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      showSuccess("Organization settings saved successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save organization settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailNotifications, callAlerts, weeklyReport }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      showSuccess("Notification preferences saved successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save notification preferences");
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "organization" as const, label: "Organization", icon: Building2 },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
    { id: "security" as const, label: "Security", icon: Shield },
  ];

  const quickLinks = [
    { href: "/dashboard/settings/audit-logs", label: "Audit Logs", icon: FileText },
    { href: "/dashboard/developers", label: "API Keys", icon: Key },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading settings...</span>
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
      {/* Success Message */}
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-lg bg-success/10 p-4 text-success"
        >
          <Check className="h-5 w-5" />
          <p className="text-sm font-medium">{successMessage}</p>
        </motion.div>
      )}

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-destructive"
        >
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-medium">{error}</p>
        </motion.div>
      )}

      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account and organization settings
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <motion.div variants={itemVariants} className="lg:col-span-1 space-y-4">
          {/* Tabs */}
          <div className="card-premium p-2 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick Links */}
          <div className="card-premium p-2 space-y-1">
            <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Quick Links
            </p>
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-3">
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Content */}
        <motion.div variants={itemVariants} className="lg:col-span-3">
          <div className="card-premium p-6">
            {activeTab === "profile" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Profile Settings
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Update your personal information
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className="input-field"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="input-field"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Changing your email will require verification
                  </p>
                </div>

                <div className="flex justify-end pt-4">
                  <button onClick={handleSaveProfile} className="btn-primary" disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {activeTab === "organization" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Organization Settings
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage your organization details
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Acme Inc"
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Industry
                    </label>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="input-field"
                    >
                      <option value="">Select industry</option>
                      <option value="healthcare">Healthcare</option>
                      <option value="real_estate">Real Estate</option>
                      <option value="legal">Legal</option>
                      <option value="home_services">Home Services</option>
                      <option value="hospitality">Hospitality</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Timezone
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="input-field"
                    >
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button onClick={handleSaveOrganization} className="btn-primary" disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notification Preferences
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose how you want to be notified
                  </p>
                </div>

                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/30 transition-colors cursor-pointer">
                    <div>
                      <p className="font-medium text-foreground">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Receive email updates about your calls
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailNotifications}
                      onChange={(e) => setEmailNotifications(e.target.checked)}
                      className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/30 transition-colors cursor-pointer">
                    <div>
                      <p className="font-medium text-foreground">Call Alerts</p>
                      <p className="text-sm text-muted-foreground">
                        Get notified about missed or failed calls
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={callAlerts}
                      onChange={(e) => setCallAlerts(e.target.checked)}
                      className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/30 transition-colors cursor-pointer">
                    <div>
                      <p className="font-medium text-foreground">Weekly Report</p>
                      <p className="text-sm text-muted-foreground">
                        Receive a weekly summary of your activity
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={weeklyReport}
                      onChange={(e) => setWeeklyReport(e.target.checked)}
                      className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
                    />
                  </label>
                </div>

                <div className="flex justify-end pt-4">
                  <button onClick={handleSaveNotifications} className="btn-primary" disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Security Settings
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage your account security
                  </p>
                </div>

                {/* Password Change */}
                <div className="p-4 rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Password</p>
                      <p className="text-sm text-muted-foreground">
                        Change your account password
                      </p>
                    </div>
                    <button className="btn-secondary">Change Password</button>
                  </div>
                </div>

                {/* Two-Factor Authentication */}
                <div className="p-4 rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Two-Factor Authentication</p>
                      <p className="text-sm text-muted-foreground">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                    <button className="btn-secondary">Enable 2FA</button>
                  </div>
                </div>

                {/* Sessions */}
                <div className="p-4 rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Active Sessions</p>
                      <p className="text-sm text-muted-foreground">
                        Manage your active login sessions
                      </p>
                    </div>
                    <button className="btn-secondary">View Sessions</button>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-destructive">Delete Account</p>
                      <p className="text-sm text-muted-foreground">
                        Permanently delete your account and all data
                      </p>
                    </div>
                    <button className="btn-destructive">Delete Account</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
