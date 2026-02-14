/**
 * Webhook URL Validation
 *
 * Validates webhook URLs before configuring them with Twilio.
 * Ensures URLs are properly formatted and optionally reachable.
 *
 * @module lib/voice/webhook-validation
 */

export interface WebhookValidationResult {
  valid: boolean;
  voiceUrl: string;
  statusUrl: string;
  errors: string[];
  warnings: string[];
}

export interface WebhookConfig {
  voiceUrl: string;
  statusUrl: string;
  baseUrl: string;
}

/**
 * Validate a URL string
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Check if URL uses HTTPS (required for production)
 */
function isSecureUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Check if URL is localhost (allowed for development)
 */
function isLocalhost(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

/**
 * Get webhook configuration from environment
 */
export function getWebhookConfig(): WebhookConfig | null {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;

  if (!baseUrl) {
    return null;
  }

  return {
    baseUrl,
    voiceUrl: `${baseUrl}/api/voice/twilio`,
    statusUrl: `${baseUrl}/api/voice/twilio?action=status`,
  };
}

/**
 * Validate webhook URLs for Twilio configuration
 */
export function validateWebhookUrls(): WebhookValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const config = getWebhookConfig();

  if (!config) {
    return {
      valid: false,
      voiceUrl: "",
      statusUrl: "",
      errors: [
        "NEXTAUTH_URL environment variable is not set. This is required for Twilio webhooks to work.",
      ],
      warnings: [],
    };
  }

  const { baseUrl, voiceUrl, statusUrl } = config;

  // Validate base URL format
  if (!isValidUrl(baseUrl)) {
    errors.push(
      `Invalid NEXTAUTH_URL format: "${baseUrl}". Must be a valid HTTP/HTTPS URL.`
    );
  }

  // Check for localhost in production
  const isProduction = process.env.NODE_ENV === "production";
  const isLocal = isLocalhost(baseUrl);

  if (isProduction && isLocal) {
    errors.push(
      "Cannot use localhost URL in production. NEXTAUTH_URL must be a publicly accessible URL."
    );
  }

  // Warn about HTTP in production
  if (isProduction && !isSecureUrl(baseUrl)) {
    warnings.push(
      "Using HTTP instead of HTTPS. Twilio requires HTTPS for production webhooks. " +
        "Your webhooks may not work correctly."
    );
  }

  // Warn about localhost in development (ngrok recommended)
  if (!isProduction && isLocal) {
    warnings.push(
      "Using localhost URL. Twilio cannot reach localhost directly. " +
        "Consider using ngrok or a similar tunneling service for testing."
    );
  }

  // Validate webhook paths are accessible
  if (!voiceUrl.includes("/api/voice/twilio")) {
    errors.push("Voice webhook URL is malformed.");
  }

  return {
    valid: errors.length === 0,
    voiceUrl,
    statusUrl,
    errors,
    warnings,
  };
}

/**
 * Optional: Test if webhook URL is reachable
 * This makes an OPTIONS request to check if the endpoint exists
 */
export async function testWebhookReachability(
  url: string,
  timeoutMs: number = 5000
): Promise<{ reachable: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "OPTIONS",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 200, 204, 405 (method not allowed) all indicate the endpoint exists
    if (response.ok || response.status === 405 || response.status === 404) {
      return { reachable: true };
    }

    return {
      reachable: false,
      error: `Endpoint returned status ${response.status}`,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { reachable: false, error: "Request timed out" };
    }
    return {
      reachable: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Full webhook validation with optional reachability test
 */
export async function validateWebhooksComplete(
  testReachability: boolean = false
): Promise<WebhookValidationResult> {
  const result = validateWebhookUrls();

  if (!result.valid || !testReachability) {
    return result;
  }

  // Only test reachability for non-localhost URLs
  if (!isLocalhost(result.voiceUrl)) {
    const reachabilityTest = await testWebhookReachability(result.voiceUrl);
    if (!reachabilityTest.reachable) {
      result.warnings.push(
        `Voice webhook URL may not be reachable: ${reachabilityTest.error}. ` +
          "Ensure your server is running and publicly accessible."
      );
    }
  }

  return result;
}
