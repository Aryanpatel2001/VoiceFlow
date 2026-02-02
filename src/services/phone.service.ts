/**
 * Phone Number Service
 *
 * Manages phone numbers - purchasing, configuring, and assigning flows.
 * Integrates with Twilio for number provisioning.
 *
 * @module services/phone
 */

import { query } from "@/lib/db";

// Types
export interface PhoneNumber {
  id: string;
  organizationId: string;
  number: string;
  countryCode: string;
  provider: string;
  providerId: string | null;
  friendlyName: string | null;
  capabilities: { voice: boolean; sms: boolean };
  status: "active" | "inactive" | "pending";
  monthlyCost: number;
  assignedFlowId: string | null;
  assignedFlowName?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PhoneNumberRow {
  id: string;
  organization_id: string;
  number: string;
  country_code: string;
  provider: string;
  provider_id: string | null;
  friendly_name: string | null;
  capabilities: { voice: boolean; sms: boolean } | string;
  status: string;
  monthly_cost: string;
  assigned_flow_id: string | null;
  flow_name?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AvailableNumber {
  number: string;
  friendlyName: string;
  locality: string;
  region: string;
  countryCode: string;
  capabilities: { voice: boolean; sms: boolean };
  monthlyCost: number;
}

// ============================================
// Get Phone Numbers by Organization
// ============================================

export async function getPhoneNumbers(
  organizationId: string
): Promise<PhoneNumber[]> {
  const result = await query<PhoneNumberRow>(
    `SELECT pn.*, f.name as flow_name
     FROM phone_numbers pn
     LEFT JOIN flows f ON pn.assigned_flow_id = f.id
     WHERE pn.organization_id = $1
     ORDER BY pn.created_at DESC`,
    [organizationId]
  );

  return result.rows.map(rowToPhoneNumber);
}

// ============================================
// Get Phone Number by ID
// ============================================

export async function getPhoneNumberById(
  id: string,
  organizationId: string
): Promise<PhoneNumber | null> {
  const result = await query<PhoneNumberRow>(
    `SELECT pn.*, f.name as flow_name
     FROM phone_numbers pn
     LEFT JOIN flows f ON pn.assigned_flow_id = f.id
     WHERE pn.id = $1 AND pn.organization_id = $2`,
    [id, organizationId]
  );

  return result.rows.length > 0 ? rowToPhoneNumber(result.rows[0]) : null;
}

// ============================================
// Purchase Phone Number (Twilio)
// ============================================

export async function purchasePhoneNumber(
  organizationId: string,
  number: string,
  friendlyName?: string
): Promise<PhoneNumber> {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;

  if (!twilioSid || !twilioAuth) {
    throw new Error("Twilio credentials not configured");
  }

  // Purchase number via Twilio API
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const voiceUrl = `${baseUrl}/api/voice/twilio`;
  const statusUrl = `${baseUrl}/api/voice/twilio?action=status`;

  const twilioResponse = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/IncomingPhoneNumbers.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioAuth}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        PhoneNumber: number,
        FriendlyName: friendlyName || `VoiceFlow Pro - ${number}`,
        VoiceUrl: voiceUrl,
        VoiceMethod: "POST",
        StatusCallback: statusUrl,
        StatusCallbackMethod: "POST",
      }),
    }
  );

  if (!twilioResponse.ok) {
    const error = await twilioResponse.json();
    throw new Error(`Twilio error: ${error.message || "Failed to purchase number"}`);
  }

  const twilioNumber = await twilioResponse.json();

  // Save to database
  const result = await query<PhoneNumberRow>(
    `INSERT INTO phone_numbers (
      organization_id, number, country_code, provider, provider_id,
      friendly_name, capabilities, status, monthly_cost
    ) VALUES ($1, $2, $3, 'twilio', $4, $5, $6, 'active', $7)
    RETURNING *`,
    [
      organizationId,
      twilioNumber.phone_number,
      twilioNumber.phone_number?.substring(0, 2) === "+1" ? "US" : "INT",
      twilioNumber.sid,
      friendlyName || twilioNumber.friendly_name,
      JSON.stringify({
        voice: twilioNumber.capabilities?.voice ?? true,
        sms: twilioNumber.capabilities?.sms ?? true,
      }),
      5.0, // Default monthly cost
    ]
  );

  return rowToPhoneNumber(result.rows[0]);
}

// ============================================
// Add Phone Number (Manual / Testing)
// ============================================

export async function addPhoneNumber(
  organizationId: string,
  input: {
    number: string;
    friendlyName?: string;
    provider?: string;
    providerId?: string;
  }
): Promise<PhoneNumber> {
  const result = await query<PhoneNumberRow>(
    `INSERT INTO phone_numbers (
      organization_id, number, country_code, provider, provider_id,
      friendly_name, capabilities, status, monthly_cost
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', 0)
    RETURNING *`,
    [
      organizationId,
      input.number,
      input.number.startsWith("+1") ? "US" : "INT",
      input.provider || "manual",
      input.providerId || null,
      input.friendlyName || input.number,
      JSON.stringify({ voice: true, sms: false }),
    ]
  );

  return rowToPhoneNumber(result.rows[0]);
}

// ============================================
// Assign Flow to Phone Number
// ============================================

export async function assignFlow(
  phoneNumberId: string,
  organizationId: string,
  flowId: string | null
): Promise<PhoneNumber | null> {
  // Verify flow belongs to org (if flowId provided)
  if (flowId) {
    const flowCheck = await query(
      `SELECT id FROM flows WHERE id = $1 AND organization_id = $2`,
      [flowId, organizationId]
    );
    if (flowCheck.rows.length === 0) {
      throw new Error("Flow not found");
    }
  }

  const result = await query<PhoneNumberRow>(
    `UPDATE phone_numbers SET assigned_flow_id = $1, updated_at = NOW()
     WHERE id = $2 AND organization_id = $3
     RETURNING *`,
    [flowId, phoneNumberId, organizationId]
  );

  if (result.rows.length === 0) return null;
  return rowToPhoneNumber(result.rows[0]);
}

// ============================================
// Update Phone Number
// ============================================

export async function updatePhoneNumber(
  id: string,
  organizationId: string,
  input: { friendlyName?: string; status?: "active" | "inactive" }
): Promise<PhoneNumber | null> {
  const result = await query<PhoneNumberRow>(
    `UPDATE phone_numbers SET
      friendly_name = COALESCE($1, friendly_name),
      status = COALESCE($2, status),
      updated_at = NOW()
     WHERE id = $3 AND organization_id = $4
     RETURNING *`,
    [input.friendlyName || null, input.status || null, id, organizationId]
  );

  if (result.rows.length === 0) return null;
  return rowToPhoneNumber(result.rows[0]);
}

// ============================================
// Delete Phone Number
// ============================================

export async function deletePhoneNumber(
  id: string,
  organizationId: string
): Promise<boolean> {
  // Get number details for Twilio release
  const number = await getPhoneNumberById(id, organizationId);
  if (!number) return false;

  // Release from Twilio if applicable
  if (number.provider === "twilio" && number.providerId) {
    try {
      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioAuth = process.env.TWILIO_AUTH_TOKEN;

      if (twilioSid && twilioAuth) {
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/IncomingPhoneNumbers/${number.providerId}.json`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioAuth}`).toString("base64")}`,
            },
          }
        );
      }
    } catch (error) {
      console.error("Failed to release Twilio number:", error);
    }
  }

  const result = await query(
    `DELETE FROM phone_numbers WHERE id = $1 AND organization_id = $2`,
    [id, organizationId]
  );

  return (result.rowCount ?? 0) > 0;
}

// ============================================
// Search Available Numbers (Twilio)
// ============================================

export async function searchAvailableNumbers(
  countryCode: string = "US",
  options?: { areaCode?: string; contains?: string; limit?: number }
): Promise<AvailableNumber[]> {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;

  if (!twilioSid || !twilioAuth) {
    throw new Error("Twilio credentials not configured");
  }

  const params = new URLSearchParams();
  if (options?.areaCode) params.set("AreaCode", options.areaCode);
  if (options?.contains) params.set("Contains", options.contains);
  params.set("VoiceEnabled", "true");
  params.set("PageSize", String(options?.limit || 10));

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/AvailablePhoneNumbers/${countryCode}/Local.json?${params}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioAuth}`).toString("base64")}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to search available numbers");
  }

  const data = await response.json();

  return (data.available_phone_numbers || []).map((n: Record<string, unknown>) => ({
    number: n.phone_number as string,
    friendlyName: n.friendly_name as string,
    locality: n.locality as string || "",
    region: n.region as string || "",
    countryCode,
    capabilities: {
      voice: (n.capabilities as Record<string, boolean>)?.voice ?? true,
      sms: (n.capabilities as Record<string, boolean>)?.sms ?? false,
    },
    monthlyCost: 5.0,
  }));
}

// ============================================
// Helper Functions
// ============================================

function rowToPhoneNumber(row: PhoneNumberRow): PhoneNumber {
  const capabilities = typeof row.capabilities === "string"
    ? JSON.parse(row.capabilities)
    : row.capabilities;

  return {
    id: row.id,
    organizationId: row.organization_id,
    number: row.number,
    countryCode: row.country_code,
    provider: row.provider,
    providerId: row.provider_id,
    friendlyName: row.friendly_name,
    capabilities,
    status: row.status as "active" | "inactive" | "pending",
    monthlyCost: parseFloat(row.monthly_cost),
    assignedFlowId: row.assigned_flow_id,
    assignedFlowName: row.flow_name || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
