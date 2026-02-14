/**
 * Voice Pipeline Error Handling
 *
 * Comprehensive error handling and recovery strategies for voice calls.
 * Handles network failures, service outages, and edge cases.
 *
 * @module lib/voice/error-handling
 */

// ============================================
// Error Types
// ============================================

export enum VoiceErrorCode {
  // Network errors
  NETWORK_TIMEOUT = "NETWORK_TIMEOUT",
  CONNECTION_LOST = "CONNECTION_LOST",

  // STT errors
  STT_CONNECTION_FAILED = "STT_CONNECTION_FAILED",
  STT_TRANSCRIPTION_FAILED = "STT_TRANSCRIPTION_FAILED",
  STT_AUDIO_FORMAT_ERROR = "STT_AUDIO_FORMAT_ERROR",

  // LLM errors
  LLM_API_ERROR = "LLM_API_ERROR",
  LLM_RATE_LIMITED = "LLM_RATE_LIMITED",
  LLM_CONTEXT_OVERFLOW = "LLM_CONTEXT_OVERFLOW",
  LLM_TIMEOUT = "LLM_TIMEOUT",

  // TTS errors
  TTS_SYNTHESIS_FAILED = "TTS_SYNTHESIS_FAILED",
  TTS_VOICE_NOT_FOUND = "TTS_VOICE_NOT_FOUND",
  TTS_RATE_LIMITED = "TTS_RATE_LIMITED",

  // Flow errors
  FLOW_NOT_FOUND = "FLOW_NOT_FOUND",
  FLOW_EXECUTION_ERROR = "FLOW_EXECUTION_ERROR",
  INVALID_NODE = "INVALID_NODE",

  // Integration errors
  INTEGRATION_NOT_CONNECTED = "INTEGRATION_NOT_CONNECTED",
  INTEGRATION_ACTION_FAILED = "INTEGRATION_ACTION_FAILED",

  // Call errors
  CALL_DURATION_EXCEEDED = "CALL_DURATION_EXCEEDED",
  USER_DISCONNECTED = "USER_DISCONNECTED",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export class VoiceError extends Error {
  code: VoiceErrorCode;
  retryable: boolean;
  userMessage: string;
  originalError?: Error;

  constructor(
    code: VoiceErrorCode,
    message: string,
    options?: {
      retryable?: boolean;
      userMessage?: string;
      originalError?: Error;
    }
  ) {
    super(message);
    this.name = "VoiceError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.userMessage = options?.userMessage ?? getDefaultUserMessage(code);
    this.originalError = options?.originalError;
  }
}

// ============================================
// User-Friendly Error Messages
// ============================================

function getDefaultUserMessage(code: VoiceErrorCode): string {
  switch (code) {
    case VoiceErrorCode.NETWORK_TIMEOUT:
    case VoiceErrorCode.CONNECTION_LOST:
      return "I'm having trouble with the connection. Please hold on a moment.";

    case VoiceErrorCode.STT_CONNECTION_FAILED:
    case VoiceErrorCode.STT_TRANSCRIPTION_FAILED:
      return "I'm having trouble hearing you. Could you repeat that?";

    case VoiceErrorCode.LLM_API_ERROR:
    case VoiceErrorCode.LLM_TIMEOUT:
      return "I need a moment to think. Please hold on.";

    case VoiceErrorCode.LLM_RATE_LIMITED:
      return "I'm getting a lot of calls right now. Let me try again.";

    case VoiceErrorCode.TTS_SYNTHESIS_FAILED:
    case VoiceErrorCode.TTS_RATE_LIMITED:
      return ""; // Silent failure - don't speak about TTS errors

    case VoiceErrorCode.FLOW_NOT_FOUND:
    case VoiceErrorCode.FLOW_EXECUTION_ERROR:
      return "I'm sorry, there was a problem with my setup. Let me transfer you to someone who can help.";

    case VoiceErrorCode.INTEGRATION_NOT_CONNECTED:
      return "I'm unable to access that system right now. Is there something else I can help with?";

    case VoiceErrorCode.INTEGRATION_ACTION_FAILED:
      return "I wasn't able to complete that request. Would you like me to try again?";

    case VoiceErrorCode.CALL_DURATION_EXCEEDED:
      return "We've been on the call for a while. Is there anything else quick I can help with before we wrap up?";

    case VoiceErrorCode.USER_DISCONNECTED:
      return ""; // User is gone, no message needed

    default:
      return "I'm sorry, something went wrong. Could you repeat your request?";
  }
}

// ============================================
// Error Classification
// ============================================

export function classifyError(error: unknown): VoiceError {
  if (error instanceof VoiceError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  // Network errors
  if (
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("econnreset") ||
    lowerMessage.includes("etimedout")
  ) {
    return new VoiceError(VoiceErrorCode.NETWORK_TIMEOUT, message, {
      retryable: true,
      originalError: error instanceof Error ? error : undefined,
    });
  }

  if (
    lowerMessage.includes("econnrefused") ||
    lowerMessage.includes("socket hang up") ||
    lowerMessage.includes("network")
  ) {
    return new VoiceError(VoiceErrorCode.CONNECTION_LOST, message, {
      retryable: true,
      originalError: error instanceof Error ? error : undefined,
    });
  }

  // Rate limiting
  if (lowerMessage.includes("429") || lowerMessage.includes("rate limit")) {
    return new VoiceError(VoiceErrorCode.LLM_RATE_LIMITED, message, {
      retryable: true,
      originalError: error instanceof Error ? error : undefined,
    });
  }

  // STT errors
  if (lowerMessage.includes("deepgram") || lowerMessage.includes("transcription")) {
    return new VoiceError(VoiceErrorCode.STT_TRANSCRIPTION_FAILED, message, {
      retryable: true,
      originalError: error instanceof Error ? error : undefined,
    });
  }

  // TTS errors
  if (lowerMessage.includes("elevenlabs") || lowerMessage.includes("tts") || lowerMessage.includes("synthesis")) {
    return new VoiceError(VoiceErrorCode.TTS_SYNTHESIS_FAILED, message, {
      retryable: true,
      originalError: error instanceof Error ? error : undefined,
    });
  }

  // LLM errors
  if (lowerMessage.includes("openai") || lowerMessage.includes("gpt")) {
    return new VoiceError(VoiceErrorCode.LLM_API_ERROR, message, {
      retryable: true,
      originalError: error instanceof Error ? error : undefined,
    });
  }

  // Default
  return new VoiceError(VoiceErrorCode.UNKNOWN_ERROR, message, {
    retryable: false,
    originalError: error instanceof Error ? error : undefined,
  });
}

// ============================================
// Retry Strategies
// ============================================

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBase: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  exponentialBase: 2,
};

/**
 * Calculate delay for retry attempt with exponential backoff and jitter
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(config.exponentialBase, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  // Add jitter: 0.5x to 1.5x
  const jitter = 0.5 + Math.random();
  return Math.floor(cappedDelay * jitter);
}

/**
 * Execute function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < fullConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const voiceError = classifyError(error);
      lastError = voiceError;

      if (!voiceError.retryable || attempt === fullConfig.maxAttempts - 1) {
        throw voiceError;
      }

      const delay = calculateRetryDelay(attempt, fullConfig);
      console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms: ${voiceError.message}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new VoiceError(VoiceErrorCode.UNKNOWN_ERROR, "Retry failed");
}

// ============================================
// Circuit Breaker
// ============================================

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: "closed" | "open" | "half-open" = "closed";
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 5,
      resetTimeoutMs: 30000,
      ...config,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      // Check if reset timeout has passed
      if (Date.now() - this.lastFailureTime > this.config.resetTimeoutMs) {
        this.state = "half-open";
      } else {
        throw new VoiceError(
          VoiceErrorCode.CONNECTION_LOST,
          "Circuit breaker is open",
          { retryable: true }
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.config.failureThreshold) {
      this.state = "open";
      console.warn(`[CircuitBreaker] Circuit opened after ${this.failures} failures`);
    }
  }

  getState(): "closed" | "open" | "half-open" {
    return this.state;
  }

  reset(): void {
    this.failures = 0;
    this.state = "closed";
  }
}

// ============================================
// Fallback Responses
// ============================================

/**
 * Fallback responses for when the main system is unavailable
 */
export const FALLBACK_RESPONSES = {
  greeting: "Hello! I'm having some technical difficulties, but I'm here to help. How can I assist you?",

  misunderstand: "I didn't quite catch that. Could you please repeat what you said?",

  error: "I'm sorry, I ran into a problem. Could you say that again?",

  unavailable: "I'm sorry, I'm unable to complete that request right now. Is there something else I can help with?",

  transferring: "Let me transfer you to someone who can help. Please hold.",

  goodbye: "Thank you for calling. Goodbye!",

  holdOn: "Just a moment please.",

  stillThere: "Are you still there?",

  maxDuration: "We've been on the call for a while. I'll need to wrap up now. Is there anything urgent before we end?",
};

/**
 * Get appropriate fallback response for error type
 */
export function getFallbackResponse(errorCode: VoiceErrorCode): string {
  switch (errorCode) {
    case VoiceErrorCode.STT_CONNECTION_FAILED:
    case VoiceErrorCode.STT_TRANSCRIPTION_FAILED:
      return FALLBACK_RESPONSES.misunderstand;

    case VoiceErrorCode.LLM_API_ERROR:
    case VoiceErrorCode.LLM_TIMEOUT:
      return FALLBACK_RESPONSES.holdOn;

    case VoiceErrorCode.FLOW_NOT_FOUND:
    case VoiceErrorCode.FLOW_EXECUTION_ERROR:
      return FALLBACK_RESPONSES.transferring;

    case VoiceErrorCode.CALL_DURATION_EXCEEDED:
      return FALLBACK_RESPONSES.maxDuration;

    default:
      return FALLBACK_RESPONSES.error;
  }
}

// ============================================
// Health Check
// ============================================

export interface ServiceHealth {
  stt: boolean;
  llm: boolean;
  tts: boolean;
  database: boolean;
}

/**
 * Check health of voice services
 */
export async function checkVoiceServicesHealth(): Promise<ServiceHealth> {
  const health: ServiceHealth = {
    stt: false,
    llm: false,
    tts: false,
    database: false,
  };

  // These are placeholder checks - implement actual health checks
  try {
    // STT check: Deepgram API key exists
    health.stt = !!process.env.DEEPGRAM_API_KEY;
  } catch {
    health.stt = false;
  }

  try {
    // LLM check: OpenAI API key exists
    health.llm = !!process.env.OPENAI_API_KEY;
  } catch {
    health.llm = false;
  }

  try {
    // TTS check: ElevenLabs API key exists
    health.tts = !!process.env.ELEVENLABS_API_KEY;
  } catch {
    health.tts = false;
  }

  try {
    // Database check: DATABASE_URL exists
    health.database = !!process.env.DATABASE_URL;
  } catch {
    health.database = false;
  }

  return health;
}
