/**
 * Salesforce CRM Integration Provider
 *
 * OAuth2 integration with Salesforce REST API.
 * Supports contact/lead lookup, creation, opportunity management, and task creation.
 *
 * @module lib/integrations/providers/salesforce
 */

import type {
  IntegrationProvider,
  IntegrationAction,
  OAuthCredentials,
  ProviderCredentials,
  ActionExecutionResult,
} from "../types";
import { fetchWithTimeout } from "@/lib/security";

const SF_AUTH_URL = "https://login.salesforce.com/services/oauth2/authorize";
const SF_TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";
const SF_API_VERSION = "v59.0";

export class SalesforceProvider implements IntegrationProvider {
  slug = "salesforce" as const;
  name = "Salesforce";
  description = "Look up contacts, create leads, manage opportunities, and log tasks";
  icon = "Cloud";
  color = "#00A1E0";
  category = "crm" as const;
  requiredScopes = ["api", "refresh_token"];

  getAuthUrl(_organizationId: string, redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.SALESFORCE_OAUTH_CLIENT_ID || "",
      redirect_uri: redirectUri,
      scope: this.requiredScopes.join(" "),
      state,
    });
    return `${SF_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, redirectUri: string): Promise<OAuthCredentials> {
    const response = await fetchWithTimeout(SF_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.SALESFORCE_OAUTH_CLIENT_ID || "",
        client_secret: process.env.SALESFORCE_OAUTH_CLIENT_SECRET || "",
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Salesforce token exchange failed: ${error}`);
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expires_at: Date.now() + 7200 * 1000, // Salesforce tokens expire in ~2 hours
      instance_url: data.instance_url,
    };
  }

  async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
    const response = await fetchWithTimeout(SF_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.SALESFORCE_OAUTH_CLIENT_ID || "",
        client_secret: process.env.SALESFORCE_OAUTH_CLIENT_SECRET || "",
        refresh_token: credentials.refresh_token,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Salesforce token refresh failed: ${error}`);
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: credentials.refresh_token,
      token_type: data.token_type,
      expires_at: Date.now() + 7200 * 1000,
      instance_url: data.instance_url || credentials.instance_url,
    };
  }

  async testConnection(credentials: ProviderCredentials): Promise<boolean> {
    const creds = credentials as OAuthCredentials;
    const response = await fetchWithTimeout(
      `${creds.instance_url}/services/data/${SF_API_VERSION}/sobjects`,
      { headers: { Authorization: `Bearer ${creds.access_token}` } }
    );
    return response.ok;
  }

  getActions(): IntegrationAction[] {
    return [
      {
        id: "salesforce.lookup_contact",
        provider: "salesforce",
        name: "Lookup Contact",
        description: "Search for a contact by email, phone, or name",
        category: "search",
        inputSchema: [
          { name: "email", type: "email", required: false, description: "Contact email" },
          { name: "phone", type: "phone", required: false, description: "Contact phone" },
          { name: "name", type: "string", required: false, description: "Contact name" },
        ],
        outputSchema: [
          { name: "found", type: "boolean", required: true, description: "Whether the contact was found" },
          { name: "contact_id", type: "string", required: false, description: "Salesforce contact ID" },
          { name: "first_name", type: "string", required: false, description: "First name" },
          { name: "last_name", type: "string", required: false, description: "Last name" },
          { name: "email", type: "email", required: false, description: "Email" },
          { name: "phone", type: "phone", required: false, description: "Phone" },
          { name: "account_name", type: "string", required: false, description: "Account/company name" },
        ],
      },
      {
        id: "salesforce.create_lead",
        provider: "salesforce",
        name: "Create Lead",
        description: "Create a new lead in Salesforce",
        category: "write",
        inputSchema: [
          { name: "first_name", type: "string", required: false, description: "First name" },
          { name: "last_name", type: "string", required: true, description: "Last name" },
          { name: "email", type: "email", required: false, description: "Email" },
          { name: "phone", type: "phone", required: false, description: "Phone" },
          { name: "company", type: "string", required: true, description: "Company name" },
          { name: "status", type: "string", required: false, description: "Lead status", default: "Open - Not Contacted" },
        ],
        outputSchema: [
          { name: "lead_id", type: "string", required: true, description: "Created lead ID" },
          { name: "created", type: "boolean", required: true, description: "Whether the lead was created" },
        ],
      },
      {
        id: "salesforce.create_contact",
        provider: "salesforce",
        name: "Create Contact",
        description: "Create a new contact in Salesforce",
        category: "write",
        inputSchema: [
          { name: "first_name", type: "string", required: false, description: "First name" },
          { name: "last_name", type: "string", required: true, description: "Last name" },
          { name: "email", type: "email", required: false, description: "Email" },
          { name: "phone", type: "phone", required: false, description: "Phone" },
          { name: "account_id", type: "string", required: false, description: "Account ID" },
        ],
        outputSchema: [
          { name: "contact_id", type: "string", required: true, description: "Created contact ID" },
          { name: "created", type: "boolean", required: true, description: "Whether the contact was created" },
        ],
      },
      {
        id: "salesforce.create_opportunity",
        provider: "salesforce",
        name: "Create Opportunity",
        description: "Create a new opportunity/deal",
        category: "write",
        inputSchema: [
          { name: "name", type: "string", required: true, description: "Opportunity name" },
          { name: "amount", type: "number", required: false, description: "Deal amount" },
          { name: "stage", type: "string", required: true, description: "Stage name" },
          { name: "close_date", type: "date", required: true, description: "Expected close date (YYYY-MM-DD)" },
          { name: "contact_id", type: "string", required: false, description: "Related contact ID" },
        ],
        outputSchema: [
          { name: "opportunity_id", type: "string", required: true, description: "Created opportunity ID" },
          { name: "created", type: "boolean", required: true, description: "Whether the opportunity was created" },
        ],
      },
      {
        id: "salesforce.add_task",
        provider: "salesforce",
        name: "Create Task",
        description: "Create a follow-up task",
        category: "write",
        inputSchema: [
          { name: "subject", type: "string", required: true, description: "Task subject" },
          { name: "description", type: "string", required: false, description: "Task description" },
          { name: "who_id", type: "string", required: false, description: "Related contact/lead ID" },
          { name: "due_date", type: "date", required: false, description: "Due date (YYYY-MM-DD)" },
          { name: "priority", type: "string", required: false, description: "Priority", default: "Normal" },
        ],
        outputSchema: [
          { name: "task_id", type: "string", required: true, description: "Created task ID" },
          { name: "created", type: "boolean", required: true, description: "Whether the task was created" },
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
    const creds = credentials as OAuthCredentials;
    const baseUrl = `${creds.instance_url}/services/data/${SF_API_VERSION}`;
    const headers = {
      Authorization: `Bearer ${creds.access_token}`,
      "Content-Type": "application/json",
    };

    try {
      switch (actionId) {
        case "salesforce.lookup_contact":
          return await this.lookupContact(inputs, baseUrl, headers);
        case "salesforce.create_lead":
          return await this.createLead(inputs, baseUrl, headers, settings);
        case "salesforce.create_contact":
          return await this.createContact(inputs, baseUrl, headers);
        case "salesforce.create_opportunity":
          return await this.createOpportunity(inputs, baseUrl, headers, settings);
        case "salesforce.add_task":
          return await this.addTask(inputs, baseUrl, headers);
        default:
          return { success: false, data: {}, error: `Unknown action: ${actionId}` };
      }
    } catch (error) {
      return {
        success: false,
        data: {},
        error: error instanceof Error ? error.message : "Salesforce action failed",
      };
    }
  }

  // ============================================================
  // Action Implementations
  // ============================================================

  private async lookupContact(
    inputs: Record<string, unknown>,
    baseUrl: string,
    headers: Record<string, string>
  ): Promise<ActionExecutionResult> {
    const conditions: string[] = [];
    if (inputs.email) conditions.push(`Email = '${inputs.email}'`);
    if (inputs.phone) conditions.push(`Phone = '${inputs.phone}'`);
    if (inputs.name) conditions.push(`Name LIKE '%${inputs.name}%'`);

    if (conditions.length === 0) {
      return { success: false, data: { found: false }, error: "Email, phone, or name required" };
    }

    const soql = `SELECT Id, FirstName, LastName, Email, Phone, Account.Name FROM Contact WHERE ${conditions.join(" OR ")} LIMIT 1`;
    const response = await fetchWithTimeout(
      `${baseUrl}/query?q=${encodeURIComponent(soql)}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`SOQL query failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.totalSize === 0) {
      return { success: true, data: { found: false } };
    }

    const record = data.records[0];
    return {
      success: true,
      data: {
        found: true,
        contact_id: record.Id,
        first_name: record.FirstName || "",
        last_name: record.LastName || "",
        email: record.Email || "",
        phone: record.Phone || "",
        account_name: record.Account?.Name || "",
      },
    };
  }

  private async createLead(
    inputs: Record<string, unknown>,
    baseUrl: string,
    headers: Record<string, string>,
    settings: Record<string, unknown>
  ): Promise<ActionExecutionResult> {
    const body: Record<string, unknown> = {
      LastName: inputs.last_name,
      Company: inputs.company,
      Status:
        inputs.status ||
        settings.default_lead_status ||
        "Open - Not Contacted",
    };
    if (inputs.first_name) body.FirstName = inputs.first_name;
    if (inputs.email) body.Email = inputs.email;
    if (inputs.phone) body.Phone = inputs.phone;

    const response = await fetchWithTimeout(`${baseUrl}/sobjects/Lead`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Create lead failed: ${error}`);
    }

    const data = await response.json();
    return { success: true, data: { lead_id: data.id, created: true } };
  }

  private async createContact(
    inputs: Record<string, unknown>,
    baseUrl: string,
    headers: Record<string, string>
  ): Promise<ActionExecutionResult> {
    const body: Record<string, unknown> = { LastName: inputs.last_name };
    if (inputs.first_name) body.FirstName = inputs.first_name;
    if (inputs.email) body.Email = inputs.email;
    if (inputs.phone) body.Phone = inputs.phone;
    if (inputs.account_id) body.AccountId = inputs.account_id;

    const response = await fetchWithTimeout(`${baseUrl}/sobjects/Contact`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Create contact failed: ${error}`);
    }

    const data = await response.json();
    return { success: true, data: { contact_id: data.id, created: true } };
  }

  private async createOpportunity(
    inputs: Record<string, unknown>,
    baseUrl: string,
    headers: Record<string, string>,
    settings: Record<string, unknown>
  ): Promise<ActionExecutionResult> {
    const body: Record<string, unknown> = {
      Name: inputs.name,
      StageName: inputs.stage || settings.default_opp_stage || "Prospecting",
      CloseDate: inputs.close_date,
    };
    if (inputs.amount) body.Amount = inputs.amount;

    const response = await fetchWithTimeout(`${baseUrl}/sobjects/Opportunity`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Create opportunity failed: ${error}`);
    }

    const data = await response.json();
    return { success: true, data: { opportunity_id: data.id, created: true } };
  }

  private async addTask(
    inputs: Record<string, unknown>,
    baseUrl: string,
    headers: Record<string, string>
  ): Promise<ActionExecutionResult> {
    const body: Record<string, unknown> = {
      Subject: inputs.subject,
      Priority: inputs.priority || "Normal",
      Status: "Not Started",
    };
    if (inputs.description) body.Description = inputs.description;
    if (inputs.who_id) body.WhoId = inputs.who_id;
    if (inputs.due_date) body.ActivityDate = inputs.due_date;

    const response = await fetchWithTimeout(`${baseUrl}/sobjects/Task`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Create task failed: ${error}`);
    }

    const data = await response.json();
    return { success: true, data: { task_id: data.id, created: true } };
  }
}
