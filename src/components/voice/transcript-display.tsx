/**
 * Transcript Display
 *
 * Real-time conversation transcript display.
 * Shows messages from both user and AI agent.
 */

"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Bot, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { type TranscriptEntry } from "@/stores/voice.store";

interface TranscriptDisplayProps {
  transcript: TranscriptEntry[];
  isConnected: boolean;
}

export function TranscriptDisplay({
  transcript,
  isConnected,
}: TranscriptDisplayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  if (!isConnected && transcript.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center text-muted-foreground">
          <Mic className="mx-auto h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Start a call to see the transcript</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 space-y-3"
    >
      <AnimatePresence initial={false}>
        {transcript.map((entry) => (
          <TranscriptMessage key={entry.id} entry={entry} />
        ))}
      </AnimatePresence>

      {isConnected && transcript.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-8"
        >
          <div className="flex items-center justify-center gap-1 mb-2">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="h-2 w-2 rounded-full bg-success animate-pulse delay-100" />
            <span className="h-2 w-2 rounded-full bg-success animate-pulse delay-200" />
          </div>
          <p className="text-sm text-muted-foreground">
            Listening... Say something to begin
          </p>
        </motion.div>
      )}
    </div>
  );
}

function TranscriptMessage({ entry }: { entry: TranscriptEntry }) {
  const isUser = entry.speaker === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary/10" : "bg-success/10"
        )}
      >
        {isUser ? (
          <User className={cn("h-4 w-4", "text-primary")} />
        ) : (
          <Bot className={cn("h-4 w-4", "text-success")} />
        )}
      </div>

      {/* Message */}
      <div
        className={cn(
          "flex-1 rounded-lg px-4 py-2 max-w-[80%]",
          isUser
            ? "bg-primary text-primary-foreground ml-auto"
            : "bg-muted"
        )}
      >
        <p
          className={cn(
            "text-sm",
            !entry.isFinal && "opacity-70 italic"
          )}
        >
          {entry.text}
          {!entry.isFinal && (
            <span className="ml-1 inline-flex gap-0.5">
              <span className="animate-pulse">.</span>
              <span className="animate-pulse delay-100">.</span>
              <span className="animate-pulse delay-200">.</span>
            </span>
          )}
        </p>
        <p
          className={cn(
            "text-xs mt-1",
            isUser ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {formatTime(entry.timestamp)}
        </p>
      </div>
    </motion.div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Compact transcript view for sidebars
 */
export function CompactTranscript({
  transcript,
  maxItems = 5,
}: {
  transcript: TranscriptEntry[];
  maxItems?: number;
}) {
  const recentTranscript = transcript.slice(-maxItems);

  return (
    <div className="space-y-2">
      {recentTranscript.map((entry) => (
        <div
          key={entry.id}
          className={cn(
            "text-xs",
            entry.speaker === "user"
              ? "text-muted-foreground"
              : "text-foreground"
          )}
        >
          <span className="font-medium">
            {entry.speaker === "user" ? "You" : "Agent"}:
          </span>{" "}
          {entry.text.length > 50
            ? entry.text.substring(0, 50) + "..."
            : entry.text}
        </div>
      ))}
    </div>
  );
}
