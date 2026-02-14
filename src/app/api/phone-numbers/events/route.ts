/**
 * Phone Numbers SSE Events API
 *
 * GET /api/phone-numbers/events - Server-Sent Events for real-time phone number updates
 *
 * Events emitted:
 * - phone_number.created - New phone number added
 * - phone_number.updated - Phone number status/settings changed
 * - phone_number.deleted - Phone number removed
 * - phone_number.call_started - Incoming call on number
 * - phone_number.call_ended - Call ended on number
 * - heartbeat - Keep-alive ping every 30s
 */

import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getPhoneNumbers } from "@/services/phone.service";
import { query } from "@/lib/db";
import {
  subscribeToPhoneNumberEvents,
  type PhoneNumberEvent,
} from "@/lib/events/phone-number-events";

// Store active SSE connections per organization
const connections = new Map<string, Set<ReadableStreamDefaultController>>();

// Subscribe to the global event system and broadcast to SSE connections
let subscribed = false;
function ensureSubscribed() {
  if (subscribed) return;
  subscribed = true;

  subscribeToPhoneNumberEvents((organizationId, event) => {
    broadcastToOrg(organizationId, event);
  });
}

/**
 * Broadcast event to all connections for an organization
 */
function broadcastToOrg(
  organizationId: string,
  event: PhoneNumberEvent
): void {
  const orgConnections = connections.get(organizationId);
  if (!orgConnections || orgConnections.size === 0) return;

  const eventString = `data: ${JSON.stringify(event)}\n\n`;
  const encoder = new TextEncoder();
  const data = encoder.encode(eventString);

  orgConnections.forEach((controller) => {
    try {
      controller.enqueue(data);
    } catch {
      // Connection closed, will be cleaned up
    }
  });
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user?.organizationId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const organizationId = user.organizationId;

  // Ensure we're subscribed to the global event system
  ensureSubscribed();

  // Create SSE stream
  const stream = new ReadableStream({
    start: async (controller) => {
      const encoder = new TextEncoder();

      // Register this connection
      if (!connections.has(organizationId)) {
        connections.set(organizationId, new Set());
      }
      connections.get(organizationId)!.add(controller);

      // Send connected event
      const connectedEvent: PhoneNumberEvent = {
        type: "connected",
        data: { message: "Connected to phone number events" },
        timestamp: new Date().toISOString(),
      };
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(connectedEvent)}\n\n`)
      );

      // Send initial state
      try {
        const phoneNumbers = await getPhoneNumbers(organizationId);
        const activeCalls = await getActiveCallsForOrg(organizationId);

        const initialState: PhoneNumberEvent = {
          type: "initial_state",
          data: {
            phoneNumbers,
            activeCalls,
            totalNumbers: phoneNumbers.length,
            activeNumbers: phoneNumbers.filter((p) => p.status === "active").length,
          },
          timestamp: new Date().toISOString(),
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(initialState)}\n\n`)
        );
      } catch (error) {
        console.error("Error sending initial state:", error);
      }

      // Heartbeat interval to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat: PhoneNumberEvent = {
            type: "heartbeat",
            data: { timestamp: Date.now() },
            timestamp: new Date().toISOString(),
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(heartbeat)}\n\n`)
          );
        } catch {
          // Connection closed
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        connections.get(organizationId)?.delete(controller);
        if (connections.get(organizationId)?.size === 0) {
          connections.delete(organizationId);
        }
      });
    },
    cancel() {
      // Stream cancelled
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// Helper to get active calls for phone numbers
async function getActiveCallsForOrg(
  organizationId: string
): Promise<Array<{ phoneNumberId: string; callId: string; status: string }>> {
  try {
    const result = await query<{
      id: string;
      phone_number_id: string;
      status: string;
    }>(
      `SELECT c.id, c.phone_number_id, c.status
       FROM calls c
       JOIN phone_numbers pn ON c.phone_number_id = pn.id
       WHERE pn.organization_id = $1
         AND c.status IN ('queued', 'ringing', 'in-progress')`,
      [organizationId]
    );

    return result.rows.map((row) => ({
      phoneNumberId: row.phone_number_id,
      callId: row.id,
      status: row.status,
    }));
  } catch {
    return [];
  }
}
