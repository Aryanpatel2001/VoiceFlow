/**
 * Call Detail Page
 *
 * Shows detailed information about a specific call including
 * transcript, events timeline, and call metadata.
 */

import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { CallDetailContent } from "@/components/calls/call-detail-content";

export const metadata: Metadata = {
  title: "Call Details",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CallDetailPage({ params }: PageProps) {
  await requireAuth();
  const { id } = await params;

  return <CallDetailContent callId={id} />;
}
