/**
 * HubSpot CRM Integration Provider
 *
 * OAuth2 integration with HubSpot CRM API v3.
 * Supports contact lookup, creation, deal management, and note logging.
 *
 * @module lib/integrations/providers/hubspot
 */

import type {
  IntegrationProvider,
  IntegrationAction,
  OAuthCredentials,
  ProviderCredentials,
  ActionExecutionResult,
} from "../types";
import { fetchWithTimeout } from "@/lib/security";

const HUBSPOT_AUTH_URL = "https://app.hubspot.com/oauth/authorize";
const HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const HUBSPOT_API_BASE = "https://api.hubapi.com";

export class HubSpotProvider implements IntegrationProvider {
  slug = "hubspot" as const;
  name = "HubSpot";
  description = "Look up contacts, create leads, manage deals, and log call notes";
  icon = "Users";
  color = "#FF7A59";
  category = "crm" as const;
  requiredScopes = [
    "crm.objects.contacts.read",
    "crm.objects.contacts.write",
    "crm.objects.deals.read",
    "crm.objects.deals.write",
  ];

  getAuthUrl(_organizationId: string, redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.HUBSPOT_OAUTH_CLIENT_ID || "",
      redirect_uri: redirectUri,
      scope: this.requiredScopes.join(" "),
      state,
    });
    return `${HUBSPOT_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, redirectUri: string): Promise<OAuthCredentials> {
    const response = await fetchWithTimeout(HUBSPOT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.HUBSPOT_OAUTH_CLIENT_ID || "",
        client_secret: process.env.HUBSPOT_OAUTH_CLIENT_SECRET || "",
        redirect_uri: redirectUri,
        code,
      }),
      timeout: 30000,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HubSpot token exchange failed: ${error}`);
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: "bearer",
      expires_at: Date.now() + data.expires_in * 1000,
    };
  }

  async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
    const response = await fetchWithTimeout(HUBSPOT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.HUBSPOT_OAUTH_CLIENT_ID || "",
        client_secret: process.env.HUBSPOT_OAUTH_CLIENT_SECRET || "",
        refresh_token: credentials.refresh_token,
      }),
      timeout: 30000,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HubSpot token refresh failed: ${error}`);
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: "bearer",
      expires_at: Date.now() + data.expires_in * 1000,
    };
  }

  async testConnection(credentials: ProviderCredentials): Promise<boolean> {
    const creds = credentials as OAuthCredentials;
    const response = await fetchWithTimeout(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts?limit=1`, {
      headers: { Authorization: `Bearer ${creds.access_token}` },
      timeout: 10000,
    });
    return response.ok;
  }

  getActions(): IntegrationAction[] {
    return [
      {
        id: "hubspot.lookup_contact",
        provider: "hubspot",
        name: "Lookup Contact",
        description: "Search for a contact by email or phone number",
        category: "search",
        inputSchema: [
          { name: "email", type: "email", required: false, description: "Contact email to search" },
          { name: "phone", type: "phone", required: false, description: "Contact phone to search" },
        ],
        outputSchema: [
          { name: "found", type: "boolean", required: true, description: "Whether the contact was found" },
          { name: "contact_id", type: "string", required: false, description: "HubSpot contact ID" },
          { name: "first_name", type: "string", required: false, description: "Contact first name" },
          { name: "last_name", type: "string", required: false, description: "Contact last name" },
          { name: "email", type: "email", required: false, description: "Contact email" },
          { name: "phone", type: "phone", required: false, description: "Contact phone" },
          { name: "company", type: "string", required: false, description: "Contact company" },
        ],
      },
      {
        id: "hubspot.create_contact",
        provider: "hubspot",
        name: "Create Contact",
        description: "Create a new contact in HubSpot",
        category: "write",
        inputSchema: [
          { name: "email", type: "email", required: true, description: "Contact email" },
          { name: "first_name", type: "string", required: false, description: "First name" },
          { name: "last_name", type: "string", required: false, description: "Last name" },
          { name: "phone", type: "phone", required: false, description: "Phone number" },
          { name: "company", type: "string", required: false, description: "Company name" },
        ],
        outputSchema: [
          { name: "contact_id", type: "string", required: true, description: "Created contact ID" },
          { name: "created", type: "boolean", required: true, description: "Whether the contact was created" },
        ],
      },
      {
        id: "hubspot.update_contact",
        provider: "hubspot",
        name: "Update Contact",
        description: "Update an existing contact's properties",
        category: "write",
        inputSchema: [
          { name: "contact_id", type: "string", required: true, description: "HubSpot contact ID" },
          { name: "email", type: "email", required: false, description: "Updated email" },
          { name: "first_name", type: "string", required: false, description: "Updated first name" },
          { name: "last_name", type: "string", required: false, description: "Updated last name" },
          { name: "phone", type: "phone", required: false, description: "Updated phone" },
          { name: "company", type: "string", required: false, description: "Updated company" },
        ],
        outputSchema: [
          { name: "updated", type: "boolean", required: true, description: "Whether the contact was updated" },
        ],
      },
      {
        id: "hubspot.create_deal",
        provider: "hubspot",
        name: "Create Deal",
        description: "Create a new deal in the CRM pipeline",
        category: "write",
        inputSchema: [
          { name: "deal_name", type: "string", required: true, description: "Deal name" },
          { name: "amount", type: "number", required: false, description: "Deal amount" },
          { name: "pipeline", type: "string", required: false, description: "Pipeline ID", default: "default" },
          { name: "stage", type: "string", required: false, description: "Pipeline stage" },
          { name: "contact_id", type: "string", required: false, description: "Associated contact ID" },
        ],
        outputSchema: [
          { name: "deal_id", type: "string", required: true, description: "Created deal ID" },
          { name: "created", type: "boolean", required: true, description: "Whether the deal was created" },
        ],
      },
      {
        id: "hubspot.add_note",
        provider: "hubspot",
        name: "Add Note",
        description: "Add a note to a contact record",
        category: "write",
        inputSchema: [
          { name: "contact_id", type: "string", required: true, description: "Contact ID to add note to" },
          { name: "note_body", type: "string", required: true, description: "Note content" },
        ],
        outputSchema: [
          { name: "note_id", type: "string", required: true, description: "Created note ID" },
          { name: "created", type: "boolean", required: true, description: "Whether the note was created" },
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
    const headers = {
      Authorization: `Bearer ${creds.access_token}`,
      "Content-Type": "application/json",
    };

    try {
      switch (actionId) {
        case "hubspot.lookup_contact":
          return await this.lookupContact(inputs, headers);
        case "hubspot.create_contact":
          return await this.createContact(inputs, headers);
        case "hubspot.update_contact":
          return await this.updateContact(inputs, headers);
        case "hubspot.create_deal":
          return await this.createDeal(inputs, headers, settings);
        case "hubspot.add_note":
          return await this.addNote(inputs, headers);
        default:
          return { success: false, data: {}, error: `Unknown action: ${actionId}` };
      }
    } catch (error) {
      return {
        success: false,
        data: {},
        error: error instanceof Error ? error.message : "HubSpot action failed",
      };
    }
  }

  // ============================================================
  // Action Implementations
  // ============================================================

  private async lookupContact(
    inputs: Record<string, unknown>,
    headers: Record<string, string>
  ): Promise<ActionExecutionResult> {
    const email = inputs.email as string;
    const phone = inputs.phone as string;

    const filters = [];
    if (email) {
      filters.push({ propertyName: "email", operator: "EQ", value: email });
    }
    if (phone) {
      filters.push({ propertyName: "phone", operator: "EQ", value: phone });
    }

    if (filters.length === 0) {
      return { success: false, data: { found: false }, error: "Email or phone required" };
    }

    const response = await fetchWithTimeout(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        filterGroups: [{ filters }],
        properties: ["firstname", "lastname", "email", "phone", "company"],
        limit: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Contact search failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.total === 0) {
      return { success: true, data: { found: false } };
    }

    const contact = data.results[0];
    return {
      success: true,
      data: {
        found: true,
        contact_id: contact.id,
        first_name: contact.properties.firstname || "",
        last_name: contact.properties.lastname || "",
        email: contact.properties.email || "",
        phone: contact.properties.phone || "",
        company: contact.properties.company || "",
      },
    };
  }

  private async createContact(
    inputs: Record<string, unknown>,
    headers: Record<string, string>
  ): Promise<ActionExecutionResult> {
    const properties: Record<string, string> = {
      email: inputs.email as string,
    };
    if (inputs.first_name) properties.firstname = inputs.first_name as string;
    if (inputs.last_name) properties.lastname = inputs.last_name as string;
    if (inputs.phone) properties.phone = inputs.phone as string;
    if (inputs.company) properties.company = inputs.company as string;

    const response = await fetchWithTimeout(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts`, {
      method: "POST",
      headers,
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Create contact failed: ${error}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: { contact_id: data.id, created: true },
    };
  }

  private async updateContact(
    inputs: Record<string, unknown>,
    headers: Record<string, string>
  ): Promise<ActionExecutionResult> {
    const contactId = inputs.contact_id as string;
    const properties: Record<string, string> = {};
    if (inputs.email) properties.email = inputs.email as string;
    if (inputs.first_name) properties.firstname = inputs.first_name as string;
    if (inputs.last_name) properties.lastname = inputs.last_name as string;
    if (inputs.phone) properties.phone = inputs.phone as string;
    if (inputs.company) properties.company = inputs.company as string;

    const response = await fetchWithTimeout(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      throw new Error(`Update contact failed: ${response.status}`);
    }

    return { success: true, data: { updated: true } };
  }

  private async createDeal(
    inputs: Record<string, unknown>,
    headers: Record<string, string>,
    settings: Record<string, unknown>
  ): Promise<ActionExecutionResult> {
    const properties: Record<string, unknown> = {
      dealname: inputs.deal_name as string,
    };
    if (inputs.amount) properties.amount = inputs.amount;
    properties.pipeline =
      inputs.pipeline || settings.default_pipeline || "default";
    const dealStage = inputs.stage || settings.default_deal_stage;
    if (dealStage) properties.dealstage = dealStage;

    const body: Record<string, unknown> = { properties };

    // Associate with contact if provided
    if (inputs.contact_id) {
      body.associations = [
        {
          to: { id: inputs.contact_id },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }],
        },
      ];
    }

    const response = await fetchWithTimeout(`${HUBSPOT_API_BASE}/crm/v3/objects/deals`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Create deal failed: ${error}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: { deal_id: data.id, created: true },
    };
  }

  private async addNote(
    inputs: Record<string, unknown>,
    headers: Record<string, string>
  ): Promise<ActionExecutionResult> {
    const contactId = inputs.contact_id as string;
    const noteBody = inputs.note_body as string;

    const response = await fetchWithTimeout(`${HUBSPOT_API_BASE}/crm/v3/objects/notes`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        properties: { hs_note_body: noteBody, hs_timestamp: new Date().toISOString() },
        associations: [
          {
            to: { id: contactId },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Add note failed: ${error}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: { note_id: data.id, created: true },
    };
  }
}
