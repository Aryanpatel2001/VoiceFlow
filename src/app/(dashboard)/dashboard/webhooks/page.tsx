/**
 * Webhook Logs Page
 *
 * Displays webhook request logs for debugging.
 */

import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { WebhookLogsContent } from "@/components/webhooks/webhook-logs-content";

export const metadata: Metadata = {
  title: "Webhook Logs",
};

export default async function WebhooksPage() {
  await requireAuth();

  return <WebhookLogsContent />;
}
