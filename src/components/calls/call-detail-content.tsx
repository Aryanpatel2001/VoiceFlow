/**
 * Call Detail Content
 *
 * Client component showing detailed call information including
 * transcript, metadata, events timeline, and sentiment.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  Clock,
  Calendar,
  User,
  Bot,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  MessageSquare,
  Activity,
  Target,
  Smile,
  Frown,
  Meh,
  FileText,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration, formatPhoneNumber } from "@/lib/utils";

interface CallEvent {
  id: string;
  call_id: string;
  event_type: string;
  speaker: "ai" | "caller" | "system" | null;
  content: string | null;
  intent: string | null;
  confidence: number | null;
  sentiment: number | null;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}

interface CallData {
  id: string;
  organization_id: string;
  direction: "inbound" | "outbound";
  caller_number: string;
  callee_number: string;
  status: string;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  primary_intent: string | null;
  intent_confidence: number | null;
  sentiment_score: number | null;
  sentiment_label: string | null;
  outcome: string | null;
  outcome_details: string | null;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  cost_amount: number;
  metadata: Record<string, unknown>;
  created_at: string;
  events: CallEvent[];
}

interface CallDetailContentProps {
  callId: string;
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

export function CallDetailContent({ callId }: CallDetailContentProps) {
  const [call, setCall] = useState<CallData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  useEffect(() => {
    async function fetchCall() {
      try {
        const res = await fetch(`/api/calls/${callId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Call not found");
          } else {
            setError("Failed to load call details");
          }
          return;
        }
        const data = await res.json();
        setCall(data.call);
      } catch {
        setError("Failed to load call details");
      } finally {
        setIsLoading(false);
      }
    }

    fetchCall();
  }, [callId]);

  const copyTranscript = () => {
    if (!call) return;

    const transcriptEvents = call.events.filter(
      (e) => e.event_type === "transcript" && e.content
    );

    let text: string;
    if (transcriptEvents.length > 0) {
      text = transcriptEvents
        .map((e) => `${e.speaker === "ai" ? "Agent" : "User"}: ${e.content}`)
        .join("\n");
    } else if (call.transcript) {
      text = call.transcript;
    } else {
      return;
    }

    navigator.clipboard.writeText(text);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Loading call details...</span>
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">
          {error || "Call not found"}
        </h2>
        <Link href="/dashboard/calls" className="btn-secondary mt-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Calls
        </Link>
      </div>
    );
  }

  const phoneNumber =
    call.direction === "inbound" ? call.caller_number : call.callee_number;
  const startedAt = new Date(call.started_at);
  const endedAt = call.ended_at ? new Date(call.ended_at) : null;
  const transcriptEvents = call.events.filter(
    (e) => e.event_type === "transcript" && e.content
  );
  const hasTranscript = transcriptEvents.length > 0 || !!call.transcript;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Back + Header */}
      <motion.div variants={itemVariants}>
        <Link
          href="/dashboard/calls"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Calls
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <DirectionIcon direction={call.direction} status={call.status} size="lg" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {phoneNumber ? formatPhoneNumber(phoneNumber) : "Test Call"}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={call.status} />
                <span className="text-sm text-muted-foreground capitalize">
                  {call.direction}
                </span>
                {call.primary_intent && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-sm text-muted-foreground capitalize">
                      {call.primary_intent}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Info Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 gap-4 sm:grid-cols-4"
      >
        <InfoCard
          icon={Clock}
          label="Duration"
          value={call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : "--:--"}
        />
        <InfoCard
          icon={Calendar}
          label="Date"
          value={startedAt.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        />
        <InfoCard
          icon={Activity}
          label="Started"
          value={startedAt.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}
        />
        <InfoCard
          icon={Target}
          label="Outcome"
          value={call.outcome || call.status}
        />
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Transcript Panel - Takes 2 columns */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <div className="card-premium !p-0 flex flex-col">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Transcript</h2>
              </div>
              {hasTranscript && (
                <button
                  onClick={copyTranscript}
                  className="btn-ghost !px-2 !py-1"
                >
                  {copiedTranscript ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-success" />
                      <span className="text-xs text-success">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span className="text-xs">Copy</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[500px] scrollbar-thin">
              {transcriptEvents.length > 0 ? (
                transcriptEvents.map((event) => (
                  <TranscriptBubble
                    key={event.id}
                    speaker={event.speaker === "ai" ? "agent" : "user"}
                    text={event.content || ""}
                    timestamp={new Date(event.timestamp)}
                  />
                ))
              ) : call.transcript ? (
                <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                  {call.transcript}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No transcript available for this call.
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Right Column - Call Info */}
        <motion.div variants={itemVariants} className="space-y-6">
          {/* Summary */}
          {call.summary && (
            <div className="card-premium">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-foreground text-sm">Summary</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {call.summary}
              </p>
            </div>
          )}

          {/* Sentiment */}
          {call.sentiment_label && (
            <div className="card-premium">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-foreground text-sm">Sentiment</h3>
              </div>
              <div className="flex items-center gap-3">
                <SentimentIcon label={call.sentiment_label} />
                <div>
                  <p className="text-sm font-medium text-foreground capitalize">
                    {call.sentiment_label}
                  </p>
                  {call.sentiment_score !== null && (
                    <p className="text-xs text-muted-foreground">
                      Score: {(call.sentiment_score * 100).toFixed(0)}%
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Call Details */}
          <div className="card-premium">
            <h3 className="font-semibold text-foreground text-sm mb-3">Details</h3>
            <dl className="space-y-3">
              <DetailRow label="Call ID" value={call.id.slice(0, 8) + "..."} />
              <DetailRow label="Direction" value={call.direction} />
              <DetailRow
                label="Caller"
                value={call.caller_number ? formatPhoneNumber(call.caller_number) : "Browser"}
              />
              <DetailRow
                label="Callee"
                value={call.callee_number ? formatPhoneNumber(call.callee_number) : "AI Agent"}
              />
              {endedAt && (
                <DetailRow
                  label="Ended"
                  value={endedAt.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                />
              )}
              {call.cost_amount > 0 && (
                <DetailRow label="Cost" value={`$${call.cost_amount.toFixed(4)}`} />
              )}
            </dl>
          </div>

          {/* Events Timeline */}
          {call.events.length > 0 && (
            <div className="card-premium">
              <h3 className="font-semibold text-foreground text-sm mb-3">Events</h3>
              <div className="space-y-3">
                {call.events
                  .filter((e) => e.event_type !== "transcript")
                  .slice(0, 10)
                  .map((event) => (
                    <EventItem key={event.id} event={event} />
                  ))}
                {call.events.filter((e) => e.event_type !== "transcript").length === 0 && (
                  <p className="text-xs text-muted-foreground">No events recorded.</p>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

function TranscriptBubble({
  speaker,
  text,
  timestamp,
}: {
  speaker: "user" | "agent";
  text: string;
  timestamp: Date;
}) {
  return (
    <div className={cn("flex gap-3", speaker === "user" ? "flex-row-reverse" : "")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          speaker === "user" ? "bg-primary/10" : "bg-success/10"
        )}
      >
        {speaker === "user" ? (
          <User className="h-4 w-4 text-primary" />
        ) : (
          <Bot className="h-4 w-4 text-success" />
        )}
      </div>
      <div
        className={cn(
          "flex-1 rounded-lg px-4 py-2.5 max-w-[80%]",
          speaker === "user"
            ? "bg-primary text-primary-foreground ml-auto"
            : "bg-muted"
        )}
      >
        <p className="text-sm">{text}</p>
        <p
          className={cn(
            "text-xs mt-1",
            speaker === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {timestamp.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })}
        </p>
      </div>
    </div>
  );
}

function DirectionIcon({
  direction,
  status,
  size = "md",
}: {
  direction: string;
  status: string;
  size?: "md" | "lg";
}) {
  const sizeClass = size === "lg" ? "h-12 w-12" : "h-9 w-9";
  const iconSize = size === "lg" ? "h-5 w-5" : "h-4 w-4";

  const bgColor =
    status === "completed" ? "bg-success/10" :
    status === "missed" ? "bg-warning/10" :
    status === "failed" ? "bg-destructive/10" :
    "bg-info/10";

  if (status === "missed") {
    return (
      <div className={cn("flex shrink-0 items-center justify-center rounded-full", sizeClass, bgColor)}>
        <PhoneMissed className={cn(iconSize, "text-warning")} />
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className={cn("flex shrink-0 items-center justify-center rounded-full", sizeClass, bgColor)}>
        <PhoneOff className={cn(iconSize, "text-destructive")} />
      </div>
    );
  }

  const iconColor =
    status === "completed" ? "text-success" : "text-info";

  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full", sizeClass, bgColor)}>
      {direction === "inbound" ? (
        <PhoneIncoming className={cn(iconSize, iconColor)} />
      ) : (
        <PhoneOutgoing className={cn(iconSize, iconColor)} />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
    completed: { label: "Completed", className: "badge-success", icon: CheckCircle2 },
    in_progress: { label: "In Progress", className: "badge-info", icon: Phone },
    missed: { label: "Missed", className: "badge-warning", icon: AlertCircle },
    failed: { label: "Failed", className: "badge-error", icon: XCircle },
    initiated: { label: "Initiated", className: "badge-info", icon: Phone },
  };

  const { label, className, icon: Icon } = config[status] || config.initiated;

  return (
    <span className={className}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="card-premium !p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm font-semibold text-foreground capitalize">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xs font-medium text-foreground capitalize">{value}</dd>
    </div>
  );
}

function SentimentIcon({ label }: { label: string }) {
  const lower = label.toLowerCase();
  if (lower === "positive") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
        <Smile className="h-5 w-5 text-success" />
      </div>
    );
  }
  if (lower === "negative") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
        <Frown className="h-5 w-5 text-destructive" />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
      <Meh className="h-5 w-5 text-warning" />
    </div>
  );
}

function EventItem({ event }: { event: CallEvent }) {
  const time = new Date(event.timestamp);

  const typeLabels: Record<string, string> = {
    connected: "Call Connected",
    ended: "Call Ended",
    intent: "Intent Detected",
    action: "Action Taken",
    error: "Error",
    transfer: "Transfer",
  };

  const typeColors: Record<string, string> = {
    connected: "bg-success",
    ended: "bg-muted-foreground",
    intent: "bg-info",
    action: "bg-primary",
    error: "bg-destructive",
    transfer: "bg-warning",
  };

  return (
    <div className="flex items-start gap-3">
      <div className="mt-1.5">
        <div className={cn("h-2 w-2 rounded-full", typeColors[event.event_type] || "bg-muted-foreground")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">
          {typeLabels[event.event_type] || event.event_type}
        </p>
        {event.content && (
          <p className="text-xs text-muted-foreground truncate">{event.content}</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {time.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })}
        </p>
      </div>
    </div>
  );
}
