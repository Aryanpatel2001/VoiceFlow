/**
 * Security Module
 *
 * Centralized security utilities for the application.
 */

export {
  isAccountLocked,
  recordLoginAttempt,
  getLockoutMessage,
  logFailedLoginAttempt,
  getDbFailedLoginCount,
} from "./account-lockout";

export {
  cleanupExpiredSessions,
  cleanupOldAuditLogs,
  cleanupOldLoginAttempts,
  runFullCleanup,
  getSessionStats,
} from "./session-cleanup";

export {
  redactPii,
  containsPii,
  partialRedact,
  type PiiType,
} from "./pii-redaction";

export {
  validateRequestBodySize,
  safeParseJSON,
  generateSecureSessionId,
  generateSecureWebhookId,
  generateSecureApiKey,
  generateSecureToken,
  hashWebhookSecret,
  verifyWebhookSecret,
  validateTwilioSignature,
  sanitizeErrorMessage,
  createSafeErrorResponse,
  sanitizeString,
  redactSensitiveFields,
  getRequestId,
  addRequestIdHeader,
  withRequestTracing,
  createRequestLogger,
  fetchWithTimeout,
  generateOAuthState,
  verifyOAuthState,
  type BodySizeLimitType,
} from "./request-security";
