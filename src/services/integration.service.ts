/**
 * Integration Service
 *
 * Database operations for managing third-party integrations.
 * Credentials are encrypted at rest using AES-256-GCM.
 *
 * @module services/integration
 */

import { query } from "@/lib/db";
import { encryptJSON, decryptJSON } from "@/lib/encryption";
import type {
  ProviderSlug,
  IntegrationStatus,
  IntegrationRow,
  OAuthCredentials,
  ProviderCredentials,
} from "@/lib/integrations/types";

// ============================================================
// Integration CRUD
// ============================================================

/**
 * Get all integrations for an organization
 */
export async function getIntegrationsByOrganization(
  organizationId: string
): Promise<IntegrationRow[]> {
  const result = await query<IntegrationRow>(
    `SELECT id, organization_id, provider, status, credentials,
            settings, last_sync_at, error_message, created_at, updated_at
     FROM integrations
     WHERE organization_id = $1
     ORDER BY created_at ASC`,
    [organizationId]
  );
  return result.rows.map(parseRow);
}

/**
 * Get a single integration by org + provider
 */
export async function getIntegration(
  organizationId: string,
  provider: string
): Promise<IntegrationRow | null> {
  const result = await query<IntegrationRow>(
    `SELECT id, organization_id, provider, status, credentials,
            settings, last_sync_at, error_message, created_at, updated_at
     FROM integrations
     WHERE organization_id = $1 AND provider = $2`,
    [organizationId, provider]
  );
  if (result.rows.length === 0) return null;
  return parseRow(result.rows[0]);
}

/**
 * Get only connected integrations (for canvas action picker)
 */
export async function getConnectedIntegrations(
  organizationId: string
): Promise<IntegrationRow[]> {
  const result = await query<IntegrationRow>(
    `SELECT id, organization_id, provider, status, credentials,
            settings, last_sync_at, error_message, created_at, updated_at
     FROM integrations
     WHERE organization_id = $1 AND status = 'connected'
     ORDER BY provider ASC`,
    [organizationId]
  );
  return result.rows.map(parseRow);
}

/**
 * Insert or update an integration (idempotent connect)
 */
export async function upsertIntegration(
  organizationId: string,
  provider: ProviderSlug,
  credentials: ProviderCredentials,
  settings: Record<string, unknown> = {}
): Promise<IntegrationRow> {
  const encryptedCreds = encryptJSON(credentials);

  const result = await query<IntegrationRow>(
    `INSERT INTO integrations (organization_id, provider, status, credentials, settings, last_sync_at)
     VALUES ($1, $2, 'connected', $3, $4, NOW())
     ON CONFLICT (organization_id, provider)
     DO UPDATE SET
       status = 'connected',
       credentials = $3,
       settings = COALESCE(integrations.settings, '{}')::jsonb || $4::jsonb,
       last_sync_at = NOW(),
       error_message = NULL,
       updated_at = NOW()
     RETURNING *`,
    [organizationId, provider, encryptedCreds, JSON.stringify(settings)]
  );
  return parseRow(result.rows[0]);
}

/**
 * Update integration status
 */
export async function updateIntegrationStatus(
  organizationId: string,
  provider: string,
  status: IntegrationStatus,
  errorMessage?: string
): Promise<void> {
  await query(
    `UPDATE integrations
     SET status = $1, error_message = $2, updated_at = NOW()
     WHERE organization_id = $3 AND provider = $4`,
    [status, errorMessage || null, organizationId, provider]
  );
}

/**
 * Update integration credentials (re-encrypt)
 */
export async function updateIntegrationCredentials(
  organizationId: string,
  provider: string,
  credentials: ProviderCredentials
): Promise<void> {
  const encryptedCreds = encryptJSON(credentials);
  await query(
    `UPDATE integrations
     SET credentials = $1, last_sync_at = NOW(), updated_at = NOW()
     WHERE organization_id = $2 AND provider = $3`,
    [encryptedCreds, organizationId, provider]
  );
}

/**
 * Update integration settings
 */
export async function updateIntegrationSettings(
  organizationId: string,
  provider: string,
  settings: Record<string, unknown>
): Promise<void> {
  await query(
    `UPDATE integrations
     SET settings = settings || $1::jsonb, updated_at = NOW()
     WHERE organization_id = $2 AND provider = $3`,
    [JSON.stringify(settings), organizationId, provider]
  );
}

/**
 * Delete an integration (disconnect)
 */
export async function deleteIntegration(
  organizationId: string,
  provider: string
): Promise<boolean> {
  const result = await query(
    `DELETE FROM integrations
     WHERE organization_id = $1 AND provider = $2`,
    [organizationId, provider]
  );
  return (result.rowCount ?? 0) > 0;
}

// ============================================================
// Credential Management
// ============================================================

/**
 * Decrypt credentials from an integration row.
 * If OAuth tokens are expiring within 5 minutes, auto-refreshes them.
 */
export async function getDecryptedCredentials(
  integration: IntegrationRow
): Promise<ProviderCredentials> {
  if (!integration.credentials) {
    throw new Error(`No credentials stored for ${integration.provider}`);
  }

  const credentials = decryptJSON<ProviderCredentials>(integration.credentials);

  // Check if OAuth token needs refresh
  if (isOAuthCredentials(credentials)) {
    const fiveMinFromNow = Date.now() + 5 * 60 * 1000;
    if (credentials.expires_at < fiveMinFromNow) {
      console.log(
        `[Integration] Token expiring soon for ${integration.provider}, refreshing...`
      );
      // Dynamic import to avoid circular dependency
      const { getProvider } = await import("@/lib/integrations/registry");
      const provider = getProvider(integration.provider);
      const refreshed = await provider.refreshToken(credentials);

      // Save refreshed credentials
      await updateIntegrationCredentials(
        integration.organization_id,
        integration.provider,
        refreshed
      );

      return refreshed;
    }
  }

  return credentials;
}

/**
 * Check if credentials are OAuth type
 */
function isOAuthCredentials(
  creds: ProviderCredentials
): creds is OAuthCredentials {
  return "access_token" in creds && "refresh_token" in creds;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Parse a database row, ensuring settings is an object
 */
function parseRow(row: IntegrationRow): IntegrationRow {
  return {
    ...row,
    settings:
      typeof row.settings === "string"
        ? JSON.parse(row.settings as unknown as string)
        : row.settings || {},
  };
}
