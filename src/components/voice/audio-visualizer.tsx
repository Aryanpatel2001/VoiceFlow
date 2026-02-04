/**
 * Audio Visualizer
 *
 * Visual indicator for audio activity during calls.
 * Shows animated bars when speaking.
 */

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AudioVisualizerProps {
  isAgentSpeaking: boolean;
  isUserSpeaking: boolean;
  isMuted: boolean;
  className?: string;
}

export function AudioVisualizer({
  isAgentSpeaking,
  isUserSpeaking,
  isMuted,
  className,
}: AudioVisualizerProps) {
  const [bars, setBars] = useState<number[]>([0.3, 0.5, 0.4, 0.6, 0.5]);
  const isActive = isAgentSpeaking || (isUserSpeaking && !isMuted);

  // Animate bars when active
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isActive) {
      interval = setInterval(() => {
        setBars(bars.map(() => 0.2 + Math.random() * 0.8));
      }, 100);
    } else {
      setBars([0.3, 0.3, 0.3, 0.3, 0.3]);
    }

    return () => clearInterval(interval);
  }, [isActive]);

  const getColor = () => {
    if (isMuted) return "bg-muted-foreground";
    if (isAgentSpeaking) return "bg-success";
    if (isUserSpeaking) return "bg-primary";
    return "bg-muted-foreground";
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1 h-16",
        className
      )}
    >
      {bars.map((height, index) => (
        <motion.div
          key={index}
          className={cn("w-2 rounded-full", getColor())}
          initial={{ height: "20%" }}
          animate={{
            height: `${height * 100}%`,
            opacity: isActive ? 1 : 0.4,
          }}
          transition={{
            duration: 0.1,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/**
 * Circular audio pulse visualizer
 */
export function AudioPulse({
  isActive,
  color = "primary",
  size = "md",
}: {
  isActive: boolean;
  color?: "primary" | "success" | "destructive";
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-16 w-16",
    lg: "h-24 w-24",
  };

  const colorClasses = {
    primary: "bg-primary",
    success: "bg-success",
    destructive: "bg-destructive",
  };

  return (
    <div className={cn("relative", sizeClasses[size])}>
      {/* Pulse rings */}
      {isActive && (
        <>
          <motion.div
            className={cn(
              "absolute inset-0 rounded-full opacity-30",
              colorClasses[color]
            )}
            animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeOut" }}
          />
          <motion.div
            className={cn(
              "absolute inset-0 rounded-full opacity-30",
              colorClasses[color]
            )}
            animate={{ scale: [1, 1.8], opacity: [0.2, 0] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeOut",
              delay: 0.2,
            }}
          />
        </>
      )}
      {/* Center dot */}
      <div
        className={cn(
          "absolute inset-2 rounded-full",
          colorClasses[color],
          isActive ? "animate-pulse" : ""
        )}
      />
    </div>
  );
}

/**
 * Waveform visualizer (for recording playback)
 */
export function Waveform({
  data,
  className,
  color = "primary",
}: {
  data: number[];
  className?: string;
  color?: "primary" | "success" | "muted";
}) {
  const colorClasses = {
    primary: "bg-primary",
    success: "bg-success",
    muted: "bg-muted-foreground",
  };

  return (
    <div className={cn("flex items-center gap-px h-8", className)}>
      {data.map((value, index) => (
        <div
          key={index}
          className={cn("w-1 rounded-full", colorClasses[color])}
          style={{ height: `${Math.max(10, value * 100)}%` }}
        />
      ))}
    </div>
  );
}
