/**
 * Voice Pipeline Metrics
 *
 * Comprehensive metrics collection for voice call performance.
 * Tracks latency, errors, and usage patterns.
 *
 * @module lib/voice/metrics
 */

// ============================================
// Types
// ============================================

export interface TurnMetrics {
  turnNumber: number;
  timestamp: Date;
  userInputLength: number;

  // Latency breakdown (ms)
  sttMs?: number;
  llmMs: number;
  ttsMs: number;
  totalMs: number;

  // Streaming metrics
  firstTokenMs?: number;
  firstSentenceMs?: number;
  sentenceCount: number;

  // Cache metrics
  ttsFromCache: boolean;

  // Quality metrics
  sttConfidence?: number;
  llmTokensUsed?: number;
}

export interface CallMetrics {
  callId: string;
  flowId?: string;
  startedAt: Date;
  endedAt?: Date;

  // Call info
  direction: "inbound" | "outbound";
  provider: "livekit" | "twilio";

  // Aggregated metrics
  totalTurns: number;
  totalDurationMs: number;
  averageTurnMs: number;
  averageLlmMs: number;
  averageTtsMs: number;
  p95TurnMs?: number;

  // Streaming metrics
  averageFirstSentenceMs?: number;
  cacheHitRate: number;

  // Outcome
  outcome: "completed" | "transferred" | "dropped" | "error";
  endReason?: string;

  // Turn-by-turn data
  turns: TurnMetrics[];
}

// ============================================
// Metrics Collector
// ============================================

export class VoiceMetricsCollector {
  private callId: string;
  private flowId?: string;
  private startedAt: Date;
  private turns: TurnMetrics[] = [];
  private direction: "inbound" | "outbound";
  private provider: "livekit" | "twilio";

  constructor(options: {
    callId: string;
    flowId?: string;
    direction: "inbound" | "outbound";
    provider: "livekit" | "twilio";
  }) {
    this.callId = options.callId;
    this.flowId = options.flowId;
    this.direction = options.direction;
    this.provider = options.provider;
    this.startedAt = new Date();
  }

  /**
   * Record metrics for a conversation turn
   */
  recordTurn(metrics: Omit<TurnMetrics, "turnNumber" | "timestamp">): void {
    this.turns.push({
      ...metrics,
      turnNumber: this.turns.length + 1,
      timestamp: new Date(),
    });

    // Log for real-time monitoring
    console.log(`[Metrics] Turn ${this.turns.length}:`, {
      totalMs: metrics.totalMs,
      llmMs: metrics.llmMs,
      ttsMs: metrics.ttsMs,
      firstSentenceMs: metrics.firstSentenceMs,
      cached: metrics.ttsFromCache,
    });
  }

  /**
   * Get current call metrics
   */
  getMetrics(outcome: CallMetrics["outcome"] = "completed", endReason?: string): CallMetrics {
    const endedAt = new Date();
    const totalDurationMs = endedAt.getTime() - this.startedAt.getTime();

    // Calculate averages
    const turnCount = this.turns.length;
    const totalTurnMs = this.turns.reduce((sum, t) => sum + t.totalMs, 0);
    const totalLlmMs = this.turns.reduce((sum, t) => sum + t.llmMs, 0);
    const totalTtsMs = this.turns.reduce((sum, t) => sum + t.ttsMs, 0);
    const cacheHits = this.turns.filter((t) => t.ttsFromCache).length;

    // Calculate P95 turn time
    const sortedTurnMs = [...this.turns.map((t) => t.totalMs)].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTurnMs.length * 0.95);
    const p95TurnMs = sortedTurnMs[p95Index];

    // Calculate average first sentence time
    const firstSentenceTimes = this.turns
      .filter((t) => t.firstSentenceMs !== undefined)
      .map((t) => t.firstSentenceMs!);
    const averageFirstSentenceMs =
      firstSentenceTimes.length > 0
        ? firstSentenceTimes.reduce((sum, t) => sum + t, 0) / firstSentenceTimes.length
        : undefined;

    return {
      callId: this.callId,
      flowId: this.flowId,
      startedAt: this.startedAt,
      endedAt,
      direction: this.direction,
      provider: this.provider,
      totalTurns: turnCount,
      totalDurationMs,
      averageTurnMs: turnCount > 0 ? Math.round(totalTurnMs / turnCount) : 0,
      averageLlmMs: turnCount > 0 ? Math.round(totalLlmMs / turnCount) : 0,
      averageTtsMs: turnCount > 0 ? Math.round(totalTtsMs / turnCount) : 0,
      p95TurnMs,
      averageFirstSentenceMs: averageFirstSentenceMs ? Math.round(averageFirstSentenceMs) : undefined,
      cacheHitRate: turnCount > 0 ? cacheHits / turnCount : 0,
      outcome,
      endReason,
      turns: this.turns,
    };
  }

  /**
   * Get summary string for logging
   */
  getSummary(): string {
    const metrics = this.getMetrics();
    return [
      `Call ${this.callId}:`,
      `  Duration: ${Math.round(metrics.totalDurationMs / 1000)}s`,
      `  Turns: ${metrics.totalTurns}`,
      `  Avg Turn: ${metrics.averageTurnMs}ms`,
      `  Avg LLM: ${metrics.averageLlmMs}ms`,
      `  Avg TTS: ${metrics.averageTtsMs}ms`,
      `  P95 Turn: ${metrics.p95TurnMs || "N/A"}ms`,
      `  First Sentence: ${metrics.averageFirstSentenceMs || "N/A"}ms`,
      `  Cache Hit Rate: ${Math.round(metrics.cacheHitRate * 100)}%`,
    ].join("\n");
  }
}

// ============================================
// Latency Thresholds
// ============================================

export const LATENCY_THRESHOLDS = {
  // Target: user should hear first word within 500ms
  firstSentence: {
    excellent: 300,
    good: 500,
    acceptable: 800,
    poor: 1200,
  },
  // Target: complete response within 2s
  totalTurn: {
    excellent: 1000,
    good: 2000,
    acceptable: 3000,
    poor: 5000,
  },
  // LLM should respond quickly
  llm: {
    excellent: 200,
    good: 500,
    acceptable: 1000,
    poor: 2000,
  },
  // TTS should be fast
  tts: {
    excellent: 300,
    good: 600,
    acceptable: 1000,
    poor: 2000,
  },
};

/**
 * Evaluate latency quality
 */
export function evaluateLatency(
  value: number,
  thresholds: { excellent: number; good: number; acceptable: number; poor: number }
): "excellent" | "good" | "acceptable" | "poor" {
  if (value <= thresholds.excellent) return "excellent";
  if (value <= thresholds.good) return "good";
  if (value <= thresholds.acceptable) return "acceptable";
  return "poor";
}

// ============================================
// Metrics Aggregation
// ============================================

/**
 * Aggregate metrics across multiple calls
 */
export function aggregateCallMetrics(calls: CallMetrics[]): {
  totalCalls: number;
  totalTurns: number;
  avgDurationMs: number;
  avgTurnsPerCall: number;
  avgTurnMs: number;
  avgFirstSentenceMs: number | null;
  overallCacheHitRate: number;
  outcomeBreakdown: Record<string, number>;
} {
  if (calls.length === 0) {
    return {
      totalCalls: 0,
      totalTurns: 0,
      avgDurationMs: 0,
      avgTurnsPerCall: 0,
      avgTurnMs: 0,
      avgFirstSentenceMs: null,
      overallCacheHitRate: 0,
      outcomeBreakdown: {},
    };
  }

  const totalCalls = calls.length;
  const totalTurns = calls.reduce((sum, c) => sum + c.totalTurns, 0);
  const totalDuration = calls.reduce((sum, c) => sum + c.totalDurationMs, 0);
  const totalTurnMs = calls.reduce((sum, c) => sum + c.averageTurnMs * c.totalTurns, 0);

  const firstSentenceCalls = calls.filter((c) => c.averageFirstSentenceMs !== undefined);
  const avgFirstSentenceMs =
    firstSentenceCalls.length > 0
      ? firstSentenceCalls.reduce((sum, c) => sum + c.averageFirstSentenceMs!, 0) / firstSentenceCalls.length
      : null;

  const totalCacheHits = calls.reduce((sum, c) => sum + c.cacheHitRate * c.totalTurns, 0);

  const outcomeBreakdown: Record<string, number> = {};
  calls.forEach((c) => {
    outcomeBreakdown[c.outcome] = (outcomeBreakdown[c.outcome] || 0) + 1;
  });

  return {
    totalCalls,
    totalTurns,
    avgDurationMs: Math.round(totalDuration / totalCalls),
    avgTurnsPerCall: Math.round((totalTurns / totalCalls) * 10) / 10,
    avgTurnMs: totalTurns > 0 ? Math.round(totalTurnMs / totalTurns) : 0,
    avgFirstSentenceMs: avgFirstSentenceMs ? Math.round(avgFirstSentenceMs) : null,
    overallCacheHitRate: totalTurns > 0 ? totalCacheHits / totalTurns : 0,
    outcomeBreakdown,
  };
}

// ============================================
// Performance Report
// ============================================

/**
 * Generate a performance report for a call
 */
export function generatePerformanceReport(metrics: CallMetrics): string {
  const lines: string[] = [
    "═══════════════════════════════════════════════════",
    "            VOICE CALL PERFORMANCE REPORT           ",
    "═══════════════════════════════════════════════════",
    "",
    `Call ID: ${metrics.callId}`,
    `Flow ID: ${metrics.flowId || "N/A"}`,
    `Provider: ${metrics.provider}`,
    `Direction: ${metrics.direction}`,
    "",
    "─── Duration ───────────────────────────────────────",
    `  Total Duration: ${Math.round(metrics.totalDurationMs / 1000)}s`,
    `  Total Turns: ${metrics.totalTurns}`,
    `  Outcome: ${metrics.outcome}${metrics.endReason ? ` (${metrics.endReason})` : ""}`,
    "",
    "─── Latency (averages) ─────────────────────────────",
    `  Total Turn:     ${metrics.averageTurnMs}ms (${evaluateLatency(metrics.averageTurnMs, LATENCY_THRESHOLDS.totalTurn)})`,
    `  LLM:            ${metrics.averageLlmMs}ms (${evaluateLatency(metrics.averageLlmMs, LATENCY_THRESHOLDS.llm)})`,
    `  TTS:            ${metrics.averageTtsMs}ms (${evaluateLatency(metrics.averageTtsMs, LATENCY_THRESHOLDS.tts)})`,
    `  First Sentence: ${metrics.averageFirstSentenceMs || "N/A"}ms${
      metrics.averageFirstSentenceMs
        ? ` (${evaluateLatency(metrics.averageFirstSentenceMs, LATENCY_THRESHOLDS.firstSentence)})`
        : ""
    }`,
    `  P95 Turn:       ${metrics.p95TurnMs || "N/A"}ms`,
    "",
    "─── Efficiency ─────────────────────────────────────",
    `  Cache Hit Rate: ${Math.round(metrics.cacheHitRate * 100)}%`,
    "",
    "─── Turn-by-Turn Breakdown ─────────────────────────",
  ];

  metrics.turns.forEach((turn) => {
    lines.push(
      `  Turn ${turn.turnNumber}: ${turn.totalMs}ms total (LLM: ${turn.llmMs}ms, TTS: ${turn.ttsMs}ms${
        turn.firstSentenceMs ? `, First: ${turn.firstSentenceMs}ms` : ""
      }${turn.ttsFromCache ? ", CACHED" : ""})`
    );
  });

  lines.push("");
  lines.push("═══════════════════════════════════════════════════");

  return lines.join("\n");
}
