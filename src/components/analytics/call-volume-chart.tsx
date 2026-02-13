/**
 * Call Volume Chart
 *
 * Bar chart showing call volume over time.
 */

"use client";

import { useMemo } from "react";

interface CallVolumeData {
  date: string;
  inbound: number;
  outbound: number;
  total: number;
}

interface CallVolumeChartProps {
  data: CallVolumeData[];
}

export function CallVolumeChart({ data }: CallVolumeChartProps) {
  const { maxValue, chartData } = useMemo(() => {
    const max = Math.max(...data.map((d) => d.total), 1);
    return {
      maxValue: max,
      chartData: data,
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
        No data available for this period
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Show every nth label to avoid crowding
  const labelInterval = Math.ceil(data.length / 7);

  return (
    <div className="h-[200px]">
      <div className="flex h-full items-end gap-1">
        {chartData.map((item, index) => {
          const inboundHeight = (item.inbound / maxValue) * 100;
          const outboundHeight = (item.outbound / maxValue) * 100;

          return (
            <div
              key={item.date}
              className="flex-1 flex flex-col items-center gap-1 group"
            >
              {/* Bars */}
              <div className="relative w-full flex-1 flex items-end justify-center gap-0.5">
                {/* Inbound bar */}
                <div
                  className="w-[45%] bg-success rounded-t transition-all group-hover:opacity-80"
                  style={{ height: `${inboundHeight}%`, minHeight: item.inbound > 0 ? "4px" : "0" }}
                />
                {/* Outbound bar */}
                <div
                  className="w-[45%] bg-info rounded-t transition-all group-hover:opacity-80"
                  style={{ height: `${outboundHeight}%`, minHeight: item.outbound > 0 ? "4px" : "0" }}
                />

                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                  <div className="bg-popover text-popover-foreground rounded-lg shadow-lg border border-border p-2 text-xs whitespace-nowrap">
                    <p className="font-semibold">{formatDate(item.date)}</p>
                    <p className="text-success">Inbound: {item.inbound}</p>
                    <p className="text-info">Outbound: {item.outbound}</p>
                    <p className="text-muted-foreground">Total: {item.total}</p>
                  </div>
                </div>
              </div>

              {/* X-axis label */}
              {index % labelInterval === 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {formatDate(item.date)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
