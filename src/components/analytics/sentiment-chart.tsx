/**
 * Sentiment Chart
 *
 * Shows sentiment distribution with icons.
 */

"use client";

import { useMemo } from "react";
import { Smile, Frown, Meh } from "lucide-react";
import { cn } from "@/lib/utils";

interface SentimentData {
  label: string;
  count: number;
  percentage: number;
}

interface SentimentChartProps {
  data: SentimentData[];
}

const sentimentConfig: Record<
  string,
  { icon: typeof Smile; color: string; bgColor: string }
> = {
  positive: { icon: Smile, color: "text-success", bgColor: "bg-success" },
  negative: { icon: Frown, color: "text-destructive", bgColor: "bg-destructive" },
  neutral: { icon: Meh, color: "text-warning", bgColor: "bg-warning" },
};

export function SentimentChart({ data }: SentimentChartProps) {
  const total = useMemo(
    () => data.reduce((sum, item) => sum + item.count, 0),
    [data]
  );

  if (data.length === 0 || total === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-muted-foreground text-sm">
        No sentiment data available
      </div>
    );
  }

  // Ensure we have all three sentiments
  const sentimentTypes = ["positive", "neutral", "negative"];
  const normalizedData = sentimentTypes.map((label) => {
    const found = data.find((d) => d.label.toLowerCase() === label);
    return found || { label, count: 0, percentage: 0 };
  });

  return (
    <div className="space-y-4">
      {/* Sentiment Bars */}
      <div className="h-3 flex rounded-full overflow-hidden bg-muted">
        {normalizedData.map((item) => {
          if (item.count === 0) return null;
          const config = sentimentConfig[item.label.toLowerCase()];
          return (
            <div
              key={item.label}
              className={cn("transition-all", config?.bgColor || "bg-muted")}
              style={{ width: `${item.percentage}%` }}
            />
          );
        })}
      </div>

      {/* Sentiment Cards */}
      <div className="grid grid-cols-3 gap-3">
        {normalizedData.map((item) => {
          const config = sentimentConfig[item.label.toLowerCase()] || {
            icon: Meh,
            color: "text-muted-foreground",
            bgColor: "bg-muted",
          };
          const Icon = config.icon;

          return (
            <div
              key={item.label}
              className="flex flex-col items-center p-3 rounded-lg bg-muted/50 border border-border/60"
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full mb-2",
                  config.bgColor + "/10"
                )}
              >
                <Icon className={cn("h-5 w-5", config.color)} />
              </div>
              <span className="text-lg font-bold text-foreground">{item.count}</span>
              <span className="text-xs text-muted-foreground capitalize">
                {item.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {item.percentage.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
