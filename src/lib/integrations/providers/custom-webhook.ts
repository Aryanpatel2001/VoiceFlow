/**
 * Custom Webhook Integration Provider
 *
 * Non-OAuth integration that sends/receives data from user-configured webhook URLs.
 * Users provide the URL and optional headers directly.
 *
 * @module lib/integrations/providers/custom-webhook
 */

import type {
  IntegrationProvider,
  IntegrationAction,
  OAuthCredentials,
  ProviderCredentials,
  WebhookCredentials,
  ActionExecutionResult,
} from "../types";
import { assertSafeWebhookUrl } from "../webhook-security";
import { fetchWithTimeout } from "@/lib/security";

export class CustomWebhookProvider implements IntegrationProvider {
  slug = "custom_webhook" as const;
  name = "Custom Webhook";
  description = "Connect to any external API or service via webhook URL";
  icon = "Webhook";
  color = "#6366F1";
  category = "webhook" as const;
  requiredScopes: string[] = [];

  // OAuth methods are no-ops for webhook provider
  getAuthUrl(): string {
    throw new Error("Custom webhook does not use OAuth");
  }

  async handleCallback(): Promise<OAuthCredentials> {
    throw new Error("Custom webhook does not use OAuth");
  }

  async refreshToken(): Promise<OAuthCredentials> {
    throw new Error("Custom webhook does not use OAuth");
  }

  async testConnection(credentials: ProviderCredentials): Promise<boolean> {
    const creds = credentials as WebhookCredentials;
    try {
      const safeUrl = await assertSafeWebhookUrl(creds.webhook_url);
      const response = await fetchWithTimeout(safeUrl.toString(), {
        method: "HEAD",
        headers: creds.headers || {},
      });
      // Accept any non-error response (even 404 means server is reachable)
      return response.status < 500;
    } catch {
      return false;
    }
  }

  getActions(): IntegrationAction[] {
    return [
      {
        id: "custom_webhook.send_data",
        provider: "custom_webhook",
        name: "Send Data",
        description: "Send a JSON payload to the configured webhook URL",
        category: "write",
        inputSchema: [
          { name: "payload", type: "object", required: true, description: "JSON payload to send" },
          { name: "method", type: "string", required: false, description: "HTTP method", default: "POST" },
          { name: "path", type: "string", required: false, description: "Path to append to webhook URL" },
        ],
        outputSchema: [
          { name: "success", type: "boolean", required: true, description: "Whether the request succeeded" },
          { name: "status_code", type: "number", required: true, description: "HTTP status code" },
          { name: "response_body", type: "object", required: false, description: "Response body" },
        ],
      },
      {
        id: "custom_webhook.fetch_data",
        provider: "custom_webhook",
        name: "Fetch Data",
        description: "Fetch data from the configured webhook URL",
        category: "read",
        inputSchema: [
          { name: "path", type: "string", required: false, description: "Path to append to webhook URL" },
          { name: "query_params", type: "object", required: false, description: "Query parameters" },
        ],
        outputSchema: [
          { name: "success", type: "boolean", required: true, description: "Whether the request succeeded" },
          { name: "status_code", type: "number", required: true, description: "HTTP status code" },
          { name: "response_body", type: "object", required: false, description: "Response body" },
        ],
      },
    ];
  }

  async executeAction(
    actionId: string,
    inputs: Record<string, unknown>,
    credentials: ProviderCredentials,
    settings: Record<string, unknown> = {}
  ): Promise<ActionExecutionResult> {
    const creds = credentials as WebhookCredentials;

    try {
      switch (actionId) {
        case "custom_webhook.send_data":
          return await this.sendData(inputs, creds, settings);
        case "custom_webhook.fetch_data":
          return await this.fetchData(inputs, creds, settings);
        default:
          return { success: false, data: {}, error: `Unknown action: ${actionId}` };
      }
    } catch (error) {
      return {
        success: false,
        data: {},
        error: error instanceof Error ? error.message : "Webhook action failed",
      };
    }
  }

  // ============================================================
  // Action Implementations
  // ============================================================

  private async sendData(
    inputs: Record<string, unknown>,
    creds: WebhookCredentials,
    settings: Record<string, unknown>
  ): Promise<ActionExecutionResult> {
    const method = (inputs.method as string) || "POST";
    const path = (inputs.path as string) || "";
    const payload = inputs.payload;

    const url = path ? `${creds.webhook_url.replace(/\/$/, "")}/${path.replace(/^\//, "")}` : creds.webhook_url;
    const safeUrl = await assertSafeWebhookUrl(url);
    const timeoutMs = Number(settings.timeout_ms) || 5000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(creds.headers || {}),
    };

    // Add webhook secret as header if configured
    if (creds.secret) {
      headers["X-Webhook-Secret"] = creds.secret;
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(safeUrl.toString(), {
        method,
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    let responseBody: unknown = null;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = await response.text().catch(() => null);
    }

    return {
      success: response.ok,
      data: {
        success: response.ok,
        status_code: response.status,
        response_body: responseBody,
      },
    };
  }

  private async fetchData(
    inputs: Record<string, unknown>,
    creds: WebhookCredentials,
    settings: Record<string, unknown>
  ): Promise<ActionExecutionResult> {
    const path = (inputs.path as string) || "";
    const queryParams = inputs.query_params as Record<string, string> | undefined;

    let url = path ? `${creds.webhook_url.replace(/\/$/, "")}/${path.replace(/^\//, "")}` : creds.webhook_url;

    if (queryParams && Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams(queryParams);
      url += `?${params.toString()}`;
    }

    const safeUrl = await assertSafeWebhookUrl(url);
    const timeoutMs = Number(settings.timeout_ms) || 5000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = { ...(creds.headers || {}) };
    if (creds.secret) {
      headers["X-Webhook-Secret"] = creds.secret;
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(safeUrl.toString(), { headers, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    let responseBody: unknown = null;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = await response.text().catch(() => null);
    }

    return {
      success: response.ok,
      data: {
        success: response.ok,
        status_code: response.status,
        response_body: responseBody,
      },
    };
  }
}
