/**
 * Integration Types
 *
 * Core interfaces for the provider-based integration system.
 * Each provider implements IntegrationProvider to plug into
 * the OAuth flow, credential storage, and canvas action execution.
 *
 * @module lib/integrations/types
 */

// ============================================================
// Provider Identifiers
// ============================================================

export type ProviderSlug =
  | "google_calendar"
  | "hubspot"
  | "salesforce"
  | "custom_webhook";

export type IntegrationStatus = "connected" | "disconnected" | "error";

// ============================================================
// Credentials
// ============================================================

export interface OAuthCredentials {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: number; // Unix timestamp (ms)
  scope?: string;
  instance_url?: string; // Salesforce-specific
}

export interface WebhookCredentials {
  webhook_url: string;
  secret?: string;
  headers?: Record<string, string>;
}

export type ProviderCredentials = OAuthCredentials | WebhookCredentials;

// ============================================================
// Integration Actions (Pre-built operations for canvas)
// ============================================================

export interface ActionField {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "email" | "phone" | "object";
  required: boolean;
  description: string;
  default?: unknown;
}

export interface IntegrationAction {
  id: string; // e.g. "google_calendar.check_availability"
  provider: ProviderSlug;
  name: string; // "Check Availability"
  description: string;
  category: "read" | "write" | "search";
  inputSchema: ActionField[];
  outputSchema: ActionField[];
}

export interface ActionExecutionResult {
  success: boolean;
  data: Record<string, unknown>;
  error?: string;
}

// ============================================================
// Provider Interface
// ============================================================

export interface IntegrationProvider {
  slug: ProviderSlug;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  color: string; // Brand color hex
  category: "calendar" | "crm" | "webhook";
  requiredScopes: string[];

  // OAuth flow
  getAuthUrl(organizationId: string, redirectUri: string, state: string): string;
  handleCallback(code: string, redirectUri: string): Promise<OAuthCredentials>;
  refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials>;
  revokeToken?(credentials: ProviderCredentials): Promise<void>;

  // Actions
  getActions(): IntegrationAction[];
  executeAction(
    actionId: string,
    inputs: Record<string, unknown>,
    credentials: ProviderCredentials,
    settings?: Record<string, unknown>
  ): Promise<ActionExecutionResult>;

  // Health check
  testConnection(credentials: ProviderCredentials): Promise<boolean>;
}

// ============================================================
// Registry Entry (for UI display)
// ============================================================

export interface ProviderRegistryEntry {
  slug: ProviderSlug;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: "calendar" | "crm" | "webhook";
  isOAuth: boolean;
  actionsCount: number;
}

// ============================================================
// Database Row
// ============================================================

export interface IntegrationRow {
  id: string;
  organization_id: string;
  provider: ProviderSlug;
  status: IntegrationStatus;
  credentials: string | null; // Encrypted string
  settings: Record<string, unknown>;
  last_sync_at: Date | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

// ============================================================
// API Response Types
// ============================================================

export interface IntegrationSummary {
  provider: ProviderSlug;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: "calendar" | "crm" | "webhook";
  status: IntegrationStatus;
  lastSyncAt: string | null;
  errorMessage: string | null;
  actionsCount: number;
}
