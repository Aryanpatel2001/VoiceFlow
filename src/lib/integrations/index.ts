/**
 * Integrations Module
 *
 * Scalable third-party integration system with provider pattern.
 * Import from this module for types, registry, and provider access.
 *
 * @module lib/integrations
 */

export * from "./types";
export {
  getProvider,
  getAllProviders,
  getProvidersByCategory,
  isValidProvider,
} from "./registry";
