/**
 * Outcome Chart
 *
 * Pie/donut chart showing call outcome distribution.
 */

"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface OutcomeData {
  status: string;
  count: number;
  percentage: number;
}

interface OutcomeChartProps {
  data: OutcomeData[];
}

const statusColors: Record<string, string> = {
  completed: "bg-success",
  failed: "bg-destructive",
  missed: "bg-warning",
  in_progress: "bg-info",
  initiated: "bg-primary",
};

const statusLabels: Record<string, string> = {
  completed: "Completed",
  failed: "Failed",
  missed: "Missed",
  in_progress: "In Progress",
  initiated: "Initiated",
};

export function OutcomeChart({ data }: OutcomeChartProps) {
  const total = useMemo(
    () => data.reduce((sum, item) => sum + item.count, 0),
    [data]
  );

  // Calculate segments for the donut chart - must be called before any early returns
  const segments = useMemo(() => {
    if (total === 0) return [];
    let currentAngle = 0;
    return data.map((item) => {
      const angle = (item.count / total) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;
      return {
        ...item,
        startAngle,
        endAngle: currentAngle,
        angle,
      };
    });
  }, [data, total]);

  if (data.length === 0 || total === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-muted-foreground text-sm">
        No data available
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      {/* Donut Chart */}
      <div className="relative w-[140px] h-[140px] flex-shrink-0">
        <svg viewBox="0 0 100 100" className="transform -rotate-90">
          {segments.map((segment, index) => {
            const radius = 40;
            const circumference = 2 * Math.PI * radius;
            const dashArray = (segment.angle / 360) * circumference;
            const dashOffset = -((segment.startAngle / 360) * circumference);

            return (
              <circle
                key={segment.status}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                strokeWidth="16"
                className={cn(
                  "transition-all",
                  statusColors[segment.status]?.replace("bg-", "stroke-") || "stroke-muted"
                )}
                style={{
                  strokeDasharray: `${dashArray} ${circumference}`,
                  strokeDashoffset: dashOffset,
                }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-2">
        {data.map((item) => (
          <div key={item.status} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  statusColors[item.status] || "bg-muted"
                )}
              />
              <span className="text-xs text-muted-foreground">
                {statusLabels[item.status] || item.status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground">{item.count}</span>
              <span className="text-xs text-muted-foreground">
                ({item.percentage.toFixed(1)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
