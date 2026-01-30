/**
 * Calls Page
 *
 * Call history with filters, stats, and call list.
 */

import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { CallsContent } from "@/components/calls/calls-content";

export const metadata: Metadata = {
  title: "Calls",
};

export default async function CallsPage() {
  await requireAuth();

  return <CallsContent />;
}
