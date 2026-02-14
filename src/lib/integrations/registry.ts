/**
 * Integration Provider Registry
 *
 * Central registry of all available integration providers.
 * Adding a new integration = creating a provider file + registering it here.
 *
 * @module lib/integrations/registry
 */

import type { ProviderSlug, IntegrationProvider, ProviderRegistryEntry } from "./types";
import { GoogleCalendarProvider } from "./providers/google-calendar";
import { HubSpotProvider } from "./providers/hubspot";
import { SalesforceProvider } from "./providers/salesforce";
import { CustomWebhookProvider } from "./providers/custom-webhook";

// ============================================================
// Provider Instances
// ============================================================

const providers: Record<ProviderSlug, IntegrationProvider> = {
  google_calendar: new GoogleCalendarProvider(),
  hubspot: new HubSpotProvider(),
  salesforce: new SalesforceProvider(),
  custom_webhook: new CustomWebhookProvider(),
};

// ============================================================
// Registry Functions
// ============================================================

/**
 * Get a provider instance by slug
 */
export function getProvider(slug: ProviderSlug): IntegrationProvider {
  const provider = providers[slug];
  if (!provider) {
    throw new Error(`Unknown integration provider: ${slug}`);
  }
  return provider;
}

/**
 * Get all available providers as registry entries (for UI)
 */
export function getAllProviders(): ProviderRegistryEntry[] {
  return Object.values(providers).map((p) => ({
    slug: p.slug,
    name: p.name,
    description: p.description,
    icon: p.icon,
    color: p.color,
    category: p.category,
    isOAuth: p.slug !== "custom_webhook",
    actionsCount: p.getActions().length,
  }));
}

/**
 * Get providers filtered by category
 */
export function getProvidersByCategory(
  category: "calendar" | "crm" | "webhook"
): ProviderRegistryEntry[] {
  return getAllProviders().filter((p) => p.category === category);
}

/**
 * Check if a slug is a valid provider
 */
export function isValidProvider(slug: string): slug is ProviderSlug {
  return slug in providers;
}
