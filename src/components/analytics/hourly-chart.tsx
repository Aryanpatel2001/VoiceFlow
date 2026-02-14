/**
 * Hourly Chart
 *
 * Shows call distribution by hour of day.
 */

"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface HourlyData {
  hour: number;
  count: number;
}

interface HourlyChartProps {
  data: HourlyData[];
}

export function HourlyChart({ data }: HourlyChartProps) {
  const { maxValue, peakHour } = useMemo(() => {
    const max = Math.max(...data.map((d) => d.count), 1);
    const peak = data.reduce(
      (acc, curr) => (curr.count > acc.count ? curr : acc),
      { hour: 0, count: 0 }
    );
    return { maxValue: max, peakHour: peak.hour };
  }, [data]);

  const formatHour = (hour: number): string => {
    if (hour === 0) return "12am";
    if (hour === 12) return "12pm";
    return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
  };

  const total = useMemo(() => data.reduce((sum, d) => sum + d.count, 0), [data]);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-muted-foreground text-sm">
        No data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Peak Hour Badge */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Peak hour</span>
        <span className="text-xs font-medium text-foreground">
          {formatHour(peakHour)}
        </span>
      </div>

      {/* Hour Grid */}
      <div className="grid grid-cols-12 gap-1">
        {data.slice(0, 24).map((item) => {
          const intensity = item.count / maxValue;
          const isPeak = item.hour === peakHour;

          return (
            <div key={item.hour} className="group relative">
              <div
                className={cn(
                  "aspect-square rounded-sm transition-all",
                  isPeak && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                )}
                style={{
                  backgroundColor: `hsl(var(--primary) / ${Math.max(0.1, intensity)})`,
                }}
              />

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                <div className="bg-popover text-popover-foreground rounded-lg shadow-lg border border-border p-2 text-xs whitespace-nowrap">
                  <p className="font-semibold">{formatHour(item.hour)}</p>
                  <p className="text-muted-foreground">{item.count} calls</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hour Labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>11pm</span>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="h-2.5 w-2.5 rounded-sm bg-primary/10" />
          <span>Low</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2.5 w-2.5 rounded-sm bg-primary/50" />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
          <span>High</span>
        </div>
      </div>
    </div>
  );
}
