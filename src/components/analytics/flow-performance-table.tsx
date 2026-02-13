/**
 * Flow Performance Table
 *
 * Table showing performance metrics per flow.
 */

"use client";

import Link from "next/link";
import { GitBranch, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlowPerformance {
  flowId: string;
  flowName: string;
  totalCalls: number;
  completedCalls: number;
  avgDuration: number;
  successRate: number;
}

interface FlowPerformanceTableProps {
  data: FlowPerformance[];
}

export function FlowPerformanceTable({ data }: FlowPerformanceTableProps) {
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <GitBranch className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">
          No flow performance data available
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">
              Flow
            </th>
            <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground">
              Calls
            </th>
            <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground">
              Completed
            </th>
            <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground">
              Success Rate
            </th>
            <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground">
              Avg Duration
            </th>
            <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((flow, index) => (
            <tr
              key={flow.flowId}
              className={cn(
                "border-b border-border/50 transition-colors hover:bg-muted/50",
                index === data.length - 1 && "border-b-0"
              )}
            >
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <GitBranch className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {flow.flowName}
                  </span>
                </div>
              </td>
              <td className="py-3 px-4 text-right">
                <span className="text-sm text-foreground">{flow.totalCalls}</span>
              </td>
              <td className="py-3 px-4 text-right">
                <span className="text-sm text-foreground">{flow.completedCalls}</span>
              </td>
              <td className="py-3 px-4 text-right">
                <span
                  className={cn(
                    "text-sm font-medium",
                    flow.successRate >= 80
                      ? "text-success"
                      : flow.successRate >= 60
                      ? "text-warning"
                      : "text-destructive"
                  )}
                >
                  {flow.successRate.toFixed(1)}%
                </span>
              </td>
              <td className="py-3 px-4 text-right">
                <span className="text-sm text-muted-foreground">
                  {formatDuration(flow.avgDuration)}
                </span>
              </td>
              <td className="py-3 px-4 text-right">
                <Link
                  href={`/dashboard/canvas/${flow.flowId}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  View
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
