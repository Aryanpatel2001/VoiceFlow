/**
 * Analytics Page
 *
 * Dashboard for call analytics, metrics, and insights.
 */

import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { AnalyticsContent } from "@/components/analytics/analytics-content";

export const metadata: Metadata = {
  title: "Analytics",
};

export default async function AnalyticsPage() {
  await requireAuth();

  return <AnalyticsContent />;
}
