/**
 * Campaigns Page
 *
 * List and manage outbound calling campaigns.
 */

import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { CampaignsContent } from "@/components/campaigns/campaigns-content";

export const metadata: Metadata = {
  title: "Campaigns",
  description: "Manage outbound calling campaigns",
};

export default async function CampaignsPage() {
  await requireAuth();
  return <CampaignsContent />;
}
