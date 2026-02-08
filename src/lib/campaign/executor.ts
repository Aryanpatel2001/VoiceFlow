/**
 * Campaign Executor
 *
 * Processes campaigns by dialing contacts within allowed windows.
 * Designed to be triggered by cron job every minute.
 *
 * @module lib/campaign/executor
 */

import {
  getCampaignsReadyToRun,
  getActiveCampaignCalls,
  getNextContactsForDialing,
  markContactInProgress,
  markContactFailed,
  type Campaign,
  type CampaignContact,
} from "@/services/campaign.service";
import { getFlowById } from "@/services/flow.service";
import { getPhoneNumbers } from "@/services/phone.service";
import { isWithinCallingWindow } from "./scheduler";

export interface ExecutionResult {
  campaignId: string;
  campaignName: string;
  callsInitiated: number;
  errors: string[];
  skipped: boolean;
  skipReason?: string;
}

export interface ExecutionSummary {
  timestamp: Date;
  campaignsProcessed: number;
  totalCallsInitiated: number;
  results: ExecutionResult[];
}

/**
 * Execute all ready campaigns
 * Should be called every minute by a cron job
 */
export async function executeReadyCampaigns(): Promise<ExecutionSummary> {
  const timestamp = new Date();
  const results: ExecutionResult[] = [];
  let totalCallsInitiated = 0;

  console.log(`[CampaignExecutor] Starting execution at ${timestamp.toISOString()}`);

  try {
    // Get all campaigns with status = 'running'
    const campaigns = await getCampaignsReadyToRun();
    console.log(`[CampaignExecutor] Found ${campaigns.length} running campaigns`);

    for (const campaign of campaigns) {
      const result = await executeCampaign(campaign);
      results.push(result);
      totalCallsInitiated += result.callsInitiated;
    }
  } catch (error) {
    console.error("[CampaignExecutor] Fatal error:", error);
  }

  console.log(
    `[CampaignExecutor] Execution complete. Initiated ${totalCallsInitiated} calls across ${results.length} campaigns`
  );

  return {
    timestamp,
    campaignsProcessed: results.length,
    totalCallsInitiated,
    results,
  };
}

/**
 * Execute a single campaign
 */
async function executeCampaign(campaign: Campaign): Promise<ExecutionResult> {
  const result: ExecutionResult = {
    campaignId: campaign.id,
    campaignName: campaign.name,
    callsInitiated: 0,
    errors: [],
    skipped: false,
  };

  console.log(`[CampaignExecutor] Processing campaign: ${campaign.name} (${campaign.id})`);

  try {
    // Check if within calling window
    if (
      !isWithinCallingWindow({
        allowedHoursStart: campaign.allowed_hours_start,
        allowedHoursEnd: campaign.allowed_hours_end,
        allowedDays: campaign.allowed_days,
        timezone: campaign.timezone,
      })
    ) {
      result.skipped = true;
      result.skipReason = "Outside calling window";
      console.log(`[CampaignExecutor] Skipping ${campaign.name}: outside calling window`);
      return result;
    }

    // Check concurrent calls limit
    const activeCalls = await getActiveCampaignCalls(campaign.id);
    const availableSlots = campaign.concurrent_calls - activeCalls;

    if (availableSlots <= 0) {
      result.skipped = true;
      result.skipReason = `At concurrent call limit (${campaign.concurrent_calls})`;
      console.log(`[CampaignExecutor] Skipping ${campaign.name}: at capacity`);
      return result;
    }

    // Get contacts to dial
    const contacts = await getNextContactsForDialing(
      campaign.id,
      availableSlots,
      campaign.retry_interval_hours,
      campaign.max_attempts
    );

    if (contacts.length === 0) {
      result.skipped = true;
      result.skipReason = "No pending contacts";
      console.log(`[CampaignExecutor] Skipping ${campaign.name}: no pending contacts`);
      return result;
    }

    console.log(
      `[CampaignExecutor] Dialing ${contacts.length} contacts for ${campaign.name}`
    );

    // Initiate calls for each contact
    for (const contact of contacts) {
      try {
        await initiateCallForContact(campaign, contact);
        result.callsInitiated++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Contact ${contact.id}: ${errorMsg}`);
        console.error(
          `[CampaignExecutor] Failed to dial contact ${contact.id}:`,
          error
        );

        // Revert contact status on error
        await markContactFailed(contact.id);
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Campaign error: ${errorMsg}`);
    console.error(`[CampaignExecutor] Error processing campaign ${campaign.id}:`, error);
  }

  return result;
}

/**
 * Initiate an outbound call for a campaign contact
 */
async function initiateCallForContact(
  campaign: Campaign,
  contact: CampaignContact
): Promise<void> {
  console.log(
    `[CampaignExecutor] Initiating call for contact ${contact.id} (${contact.phone_number})`
  );

  // Mark contact as in progress first (optimistic lock)
  await markContactInProgress(contact.id);

  // Get flow details
  if (!campaign.flow_id) {
    throw new Error("Campaign has no flow assigned");
  }

  const flow = await getFlowById(campaign.flow_id, campaign.organization_id);
  if (!flow) {
    throw new Error("Flow not found");
  }

  if (!flow.webhookId) {
    throw new Error("Flow is not published (no webhookId)");
  }

  // Get organization's phone numbers
  const phoneNumbers = await getPhoneNumbers(
    campaign.organization_id
  );
  const activeNumber = phoneNumbers.find((pn) => pn.status === "active");

  if (!activeNumber) {
    throw new Error("No active phone number available");
  }

  // Make the API call to initiate the outbound call
  // We call our own API endpoint to keep the logic centralized
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/voice/outbound`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Use internal API key for server-to-server calls
      "X-Internal-API-Key": process.env.INTERNAL_API_KEY || "",
    },
    body: JSON.stringify({
      fromNumber: activeNumber.number,
      toNumber: contact.phone_number,
      flowId: campaign.flow_id,
      // Pass campaign context in metadata
      campaignId: campaign.id,
      campaignContactId: contact.id,
      contactData: {
        firstName: contact.first_name,
        lastName: contact.last_name,
        email: contact.email,
        ...contact.custom_data,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const result = await response.json();
  console.log(
    `[CampaignExecutor] Call initiated for contact ${contact.id}: ${result.callId}`
  );
}

/**
 * Execute a single campaign by ID (for manual triggering)
 */
export async function executeCampaignById(
  campaignId: string,
  organizationId: string
): Promise<ExecutionResult> {
  const campaigns = await getCampaignsReadyToRun();
  const campaign = campaigns.find(
    (c) => c.id === campaignId && c.organization_id === organizationId
  );

  if (!campaign) {
    return {
      campaignId,
      campaignName: "Unknown",
      callsInitiated: 0,
      errors: ["Campaign not found or not running"],
      skipped: true,
      skipReason: "Campaign not found or not running",
    };
  }

  return executeCampaign(campaign);
}
