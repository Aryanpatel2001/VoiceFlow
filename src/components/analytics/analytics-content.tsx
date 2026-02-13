/**
 * Analytics Content
 *
 * Client component displaying analytics charts and metrics.
 */

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Phone,
  Clock,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Loader2,
  AlertCircle,
  BarChart3,
  PieChart,
  Activity,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CallVolumeChart } from "./call-volume-chart";
import { OutcomeChart } from "./outcome-chart";
import { SentimentChart } from "./sentiment-chart";
import { HourlyChart } from "./hourly-chart";
import { FlowPerformanceTable } from "./flow-performance-table";

interface AnalyticsData {
  overview: {
    totalCalls: number;
    completedCalls: number;
    failedCalls: number;
    avgDuration: number;
    totalDuration: number;
    successRate: number;
    avgSentiment: number | null;
    totalCost: number;
  };
  callVolume: Array<{
    date: string;
    inbound: number;
    outbound: number;
    total: number;
  }>;
  outcomes: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  sentiment: Array<{
    label: string;
    count: number;
    percentage: number;
  }>;
  hourlyDistribution: Array<{
    hour: number;
    count: number;
  }>;
  flowPerformance: Array<{
    flowId: string;
    flowName: string;
    totalCalls: number;
    completedCalls: number;
    avgDuration: number;
    successRate: number;
  }>;
  comparison: {
    current: { totalCalls: number; successRate: number; avgDuration: number };
    previous: { totalCalls: number; successRate: number; avgDuration: number };
    changes: {
      totalCalls: number;
      successRate: number;
      avgDuration: number;
    };
  };
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

export function AnalyticsContent() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    async function fetchAnalytics() {
      setIsLoading(true);
      setError(null);

      try {
        const now = new Date();
        let startDate: Date;

        switch (dateRange) {
          case "7d":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "90d":
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        const params = new URLSearchParams({
          startDate: startDate.toISOString(),
          endDate: now.toISOString(),
        });

        const res = await fetch(`/api/analytics?${params}`);
        if (!res.ok) {
          throw new Error("Failed to fetch analytics");
        }

        const analyticsData = await res.json();
        setData(analyticsData);
      } catch {
        setError("Failed to load analytics data");
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, [dateRange]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Loading analytics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">
          {error || "Failed to load analytics"}
        </h2>
        <button
          onClick={() => window.location.reload()}
          className="btn-secondary mt-4"
        >
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
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track call performance and insights
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Range Selector */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
            {(["7d", "30d", "90d"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  dateRange === range
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
              </button>
            ))}
          </div>

          <button className="btn-secondary">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </motion.div>

      {/* Overview Stats */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 gap-4 sm:grid-cols-4"
      >
        <StatCard
          icon={Phone}
          label="Total Calls"
          value={data.overview.totalCalls.toLocaleString()}
          change={data.comparison.changes.totalCalls}
          trend={data.comparison.changes.totalCalls >= 0 ? "up" : "down"}
        />
        <StatCard
          icon={CheckCircle2}
          label="Success Rate"
          value={`${data.overview.successRate.toFixed(1)}%`}
          change={data.comparison.changes.successRate}
          trend={data.comparison.changes.successRate >= 0 ? "up" : "down"}
          suffix="%"
        />
        <StatCard
          icon={Clock}
          label="Avg Duration"
          value={formatDuration(data.overview.avgDuration)}
          change={data.comparison.changes.avgDuration}
          trend={data.comparison.changes.avgDuration >= 0 ? "up" : "down"}
        />
        <StatCard
          icon={DollarSign}
          label="Total Cost"
          value={`$${data.overview.totalCost.toFixed(2)}`}
        />
      </motion.div>

      {/* Call Volume Chart */}
      <motion.div variants={itemVariants}>
        <div className="card-premium">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">Call Volume</h2>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                <span className="text-muted-foreground">Total</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-success" />
                <span className="text-muted-foreground">Inbound</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-info" />
                <span className="text-muted-foreground">Outbound</span>
              </div>
            </div>
          </div>
          <CallVolumeChart data={data.callVolume} />
        </div>
      </motion.div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Outcomes */}
        <motion.div variants={itemVariants}>
          <div className="card-premium h-full">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">Call Outcomes</h2>
            </div>
            <OutcomeChart data={data.outcomes} />
          </div>
        </motion.div>

        {/* Sentiment */}
        <motion.div variants={itemVariants}>
          <div className="card-premium h-full">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">Sentiment</h2>
            </div>
            <SentimentChart data={data.sentiment} />
          </div>
        </motion.div>

        {/* Hourly Distribution */}
        <motion.div variants={itemVariants}>
          <div className="card-premium h-full">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">Peak Hours</h2>
            </div>
            <HourlyChart data={data.hourlyDistribution} />
          </div>
        </motion.div>
      </div>

      {/* Flow Performance Table */}
      <motion.div variants={itemVariants}>
        <div className="card-premium">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Flow Performance</h2>
          </div>
          <FlowPerformanceTable data={data.flowPerformance} />
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  change,
  trend,
  suffix = "%",
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  change?: number;
  trend?: "up" | "down" | "neutral";
  suffix?: string;
}) {
  return (
    <div className="card-premium !p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/60 border border-border/40">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {change !== undefined && trend && (
        <div className="flex items-center gap-1 mt-1">
          {trend === "up" ? (
            <TrendingUp className="h-3 w-3 text-success" />
          ) : trend === "down" ? (
            <TrendingDown className="h-3 w-3 text-destructive" />
          ) : (
            <Minus className="h-3 w-3 text-muted-foreground" />
          )}
          <span
            className={cn(
              "text-xs font-medium",
              trend === "up"
                ? "text-success"
                : trend === "down"
                ? "text-destructive"
                : "text-muted-foreground"
            )}
          >
            {change > 0 ? "+" : ""}
            {change.toFixed(1)}
            {suffix}
          </span>
          <span className="text-xs text-muted-foreground">vs prev</span>
        </div>
      )}
    </div>
  );
}
