/**
 * Dashboard Content
 *
 * Client component for the dashboard overview.
 * Displays stats, recent calls, live activity, and quick actions.
 */

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Bot,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration, formatPhoneNumber } from "@/lib/utils";

interface DashboardContentProps {
  userName: string;
}

// Mock data - will be replaced with API calls
const stats = [
  {
    label: "Total Calls",
    value: "1,247",
    change: "+12.5%",
    trend: "up" as const,
    icon: Phone,
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    label: "Avg. Duration",
    value: "3:42",
    change: "+8.3%",
    trend: "up" as const,
    icon: Clock,
    color: "text-info",
    bgColor: "bg-info/10",
  },
  {
    label: "Success Rate",
    value: "94.2%",
    change: "+2.1%",
    trend: "up" as const,
    icon: CheckCircle2,
    color: "text-success",
    bgColor: "bg-success/10",
  },
  {
    label: "Active Agents",
    value: "8",
    change: "-1",
    trend: "down" as const,
    icon: Bot,
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
];

const recentCalls = [
  {
    id: "call_1",
    phoneNumber: "+15551234567",
    direction: "inbound" as const,
    status: "completed" as const,
    duration: 245,
    agentName: "Reception Agent",
    summary: "Customer inquired about HVAC maintenance package pricing",
    time: "2 min ago",
  },
  {
    id: "call_2",
    phoneNumber: "+15559876543",
    direction: "outbound" as const,
    status: "completed" as const,
    duration: 180,
    agentName: "Follow-up Agent",
    summary: "Appointment confirmation for tomorrow at 2 PM",
    time: "15 min ago",
  },
  {
    id: "call_3",
    phoneNumber: "+15555551234",
    direction: "inbound" as const,
    status: "missed" as const,
    duration: 0,
    agentName: "Reception Agent",
    summary: "Caller hung up before agent could connect",
    time: "32 min ago",
  },
  {
    id: "call_4",
    phoneNumber: "+15552468135",
    direction: "inbound" as const,
    status: "completed" as const,
    duration: 312,
    agentName: "Sales Agent",
    summary: "New lead qualified - interested in premium plan",
    time: "1 hour ago",
  },
  {
    id: "call_5",
    phoneNumber: "+15551357924",
    direction: "outbound" as const,
    status: "failed" as const,
    duration: 0,
    agentName: "Reminder Agent",
    summary: "Unable to reach customer - number unavailable",
    time: "1.5 hours ago",
  },
];

const liveCalls = [
  {
    id: "live_1",
    phoneNumber: "+15553216549",
    agentName: "Reception Agent",
    duration: 127,
    status: "active" as const,
  },
  {
    id: "live_2",
    phoneNumber: "+15557891234",
    agentName: "Sales Agent",
    duration: 45,
    status: "active" as const,
  },
];

const quickActions = [
  {
    label: "Create New Agent",
    href: "/dashboard/canvas",
    icon: Bot,
    description: "Build a voice agent with Canvas",
  },
  {
    label: "View Analytics",
    href: "/dashboard/analytics",
    icon: Activity,
    description: "See detailed call analytics",
  },
  {
    label: "Manage Team",
    href: "/dashboard/team",
    icon: Users,
    description: "Invite and manage team members",
  },
  {
    label: "Test Call",
    href: "/dashboard/test-call",
    icon: Phone,
    description: "Make a test call to your agent",
  },
];

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

export function DashboardContent({ userName }: DashboardContentProps) {
  const greeting = getGreeting();

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Welcome Banner */}
      <motion.div variants={itemVariants}>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {greeting}, {userName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Here&apos;s what&apos;s happening with your voice agents today.
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            {liveCalls.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-1.5">
                <span className="live-dot" />
                <span className="text-sm font-medium text-success">
                  {liveCalls.length} Live Call{liveCalls.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="card-premium flex items-start justify-between"
          >
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <div className="flex items-center gap-1">
                {stat.trend === "up" ? (
                  <TrendingUp className="h-3.5 w-3.5 text-success" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                )}
                <span
                  className={cn(
                    "text-xs font-medium",
                    stat.trend === "up" ? "text-success" : "text-destructive"
                  )}
                >
                  {stat.change}
                </span>
                <span className="text-xs text-muted-foreground">vs last week</span>
              </div>
            </div>
            <div className={cn("rounded-lg p-2.5", stat.bgColor)}>
              <stat.icon className={cn("h-5 w-5", stat.color)} />
            </div>
          </div>
        ))}
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Calls - Takes 2 columns */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <div className="card-premium !p-0">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-semibold text-foreground">Recent Calls</h2>
              <Link
                href="/dashboard/calls"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {recentCalls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center gap-4 px-6 py-3.5 hover:bg-accent/50 transition-colors"
                >
                  {/* Direction Icon */}
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      call.status === "completed" && "bg-success/10",
                      call.status === "missed" && "bg-warning/10",
                      call.status === "failed" && "bg-destructive/10"
                    )}
                  >
                    {call.direction === "inbound" ? (
                      call.status === "missed" ? (
                        <PhoneMissed className="h-4 w-4 text-warning" />
                      ) : (
                        <PhoneIncoming
                          className={cn(
                            "h-4 w-4",
                            call.status === "completed"
                              ? "text-success"
                              : "text-destructive"
                          )}
                        />
                      )
                    ) : (
                      <PhoneOutgoing
                        className={cn(
                          "h-4 w-4",
                          call.status === "completed"
                            ? "text-success"
                            : "text-destructive"
                        )}
                      />
                    )}
                  </div>

                  {/* Call Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {formatPhoneNumber(call.phoneNumber)}
                      </span>
                      <StatusBadge status={call.status} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {call.summary}
                    </p>
                  </div>

                  {/* Agent & Time */}
                  <div className="hidden sm:block text-right shrink-0">
                    <p className="text-xs font-medium text-foreground">
                      {call.agentName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {call.duration > 0 ? formatDuration(call.duration) : "—"}{" "}
                      &middot; {call.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Right Column - Live Calls & Quick Actions */}
        <motion.div variants={itemVariants} className="space-y-6">
          {/* Live Calls */}
          <div className="card-premium !p-0">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="live-dot" />
                <h2 className="font-semibold text-foreground">Live Calls</h2>
              </div>
              <span className="text-xs text-muted-foreground">
                {liveCalls.length} active
              </span>
            </div>
            <div className="divide-y divide-border">
              {liveCalls.length > 0 ? (
                liveCalls.map((call) => (
                  <div
                    key={call.id}
                    className="flex items-center justify-between px-6 py-3.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {formatPhoneNumber(call.phoneNumber)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {call.agentName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 text-success animate-pulse" />
                      <span className="text-sm font-mono text-foreground">
                        {formatDuration(call.duration)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-8 text-center">
                  <Phone className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No active calls
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card-premium !p-0">
            <div className="border-b border-border px-6 py-4">
              <h2 className="font-semibold text-foreground">Quick Actions</h2>
            </div>
            <div className="p-2">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors hover:bg-accent"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <action.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{action.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Upcoming Appointments */}
      <motion.div variants={itemVariants}>
        <div className="card-premium !p-0">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="font-semibold text-foreground">
              Today&apos;s Appointments
            </h2>
            <Link
              href="/dashboard/calendar"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View calendar
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                time: "10:00 AM",
                customer: "John Martinez",
                service: "HVAC Inspection",
                status: "confirmed",
              },
              {
                time: "2:00 PM",
                customer: "Sarah Williams",
                service: "Plumbing Repair",
                status: "pending",
              },
              {
                time: "4:30 PM",
                customer: "Mike Johnson",
                service: "Electrical Check",
                status: "confirmed",
              },
            ].map((apt, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-border p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {apt.time} - {apt.customer}
                  </p>
                  <p className="text-xs text-muted-foreground">{apt.service}</p>
                  <span
                    className={cn(
                      "mt-1 inline-block text-xs font-medium",
                      apt.status === "confirmed"
                        ? "text-success"
                        : "text-warning"
                    )}
                  >
                    {apt.status === "confirmed" ? "Confirmed" : "Pending"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: "completed" | "missed" | "failed" }) {
  const config = {
    completed: {
      label: "Completed",
      className: "badge-success",
      icon: CheckCircle2,
    },
    missed: {
      label: "Missed",
      className: "badge-warning",
      icon: AlertCircle,
    },
    failed: {
      label: "Failed",
      className: "badge-error",
      icon: XCircle,
    },
  };

  const { label, className, icon: Icon } = config[status];

  return (
    <span className={className}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
