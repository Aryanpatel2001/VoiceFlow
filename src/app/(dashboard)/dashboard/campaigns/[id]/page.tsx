/**
 * Campaign Detail Page
 *
 * View and manage a specific campaign.
 */

import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { CampaignDetailContent } from "@/components/campaigns/campaign-detail-content";

export const metadata: Metadata = {
  title: "Campaign Details",
  description: "View and manage campaign",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage({ params }: PageProps) {
  await requireAuth();
  const { id } = await params;
  return <CampaignDetailContent campaignId={id} />;
}
