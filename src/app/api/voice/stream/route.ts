/**
 * Call Transcript Stream (SSE)
 *
 * Server-Sent Events endpoint for streaming live call transcript updates.
 * Client connects and receives real-time transcript entries as they happen.
 */

import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const callId = searchParams.get("callId");

  if (!callId) {
    return new Response("callId required", { status: 400 });
  }

  // Verify call belongs to organization
  const callResult = await query(
    `SELECT id, status FROM calls WHERE id = $1 AND organization_id = $2`,
    [callId, session.user.organizationId]
  );

  if (callResult.rows.length === 0) {
    return new Response("Call not found", { status: 404 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  let lastEventTime = new Date(0).toISOString(); // Start from epoch
  let isActive = true;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Send initial connection event
      sendEvent("connected", { callId });

      // Poll for updates
      const poll = async () => {
        if (!isActive) return;

        try {
          // Get call status
          const statusResult = await query(
            `SELECT status, duration_seconds, transcript FROM calls WHERE id = $1`,
            [callId]
          );

          if (statusResult.rows.length === 0) {
            sendEvent("error", { message: "Call not found" });
            controller.close();
            return;
          }

          const call = statusResult.rows[0];

          // Get new events since last check (using timestamp for pagination)
          const eventsResult = await query(
            `SELECT id, event_type, speaker, content, metadata, timestamp
             FROM call_events
             WHERE call_id = $1 AND timestamp > $2
             ORDER BY timestamp ASC`,
            [callId, lastEventTime]
          );

          // Send new transcript entries
          for (const event of eventsResult.rows) {
            if (event.event_type === "conversation_turn") {
              const meta = event.metadata || {};
              if (meta.userInput) {
                sendEvent("transcript", {
                  speaker: "user",
                  text: meta.userInput,
                  timestamp: event.timestamp,
                });
              }
              if (meta.agentResponse) {
                sendEvent("transcript", {
                  speaker: "agent",
                  text: meta.agentResponse,
                  timestamp: event.timestamp,
                });
              }
            }
            // Update last event time
            if (event.timestamp) {
              lastEventTime = event.timestamp;
            }
          }

          // Send status update
          sendEvent("status", {
            status: call.status,
            duration: call.duration_seconds,
          });

          // If call ended, close stream
          if (call.status === "completed" || call.status === "failed") {
            sendEvent("ended", {
              status: call.status,
              transcript: call.transcript,
            });
            isActive = false;
            controller.close();
            return;
          }

          // Continue polling
          setTimeout(poll, 500); // Poll every 500ms
        } catch (error) {
          console.error("[Stream] Error polling:", error);
          if (isActive) {
            setTimeout(poll, 1000); // Retry after 1s on error
          }
        }
      };

      poll();
    },
    cancel() {
      isActive = false;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
