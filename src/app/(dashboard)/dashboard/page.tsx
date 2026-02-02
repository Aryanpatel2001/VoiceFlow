/**
 * Dashboard Overview Page
 *
 * Main dashboard with key metrics, recent calls,
 * live call activity, and quick actions.
 */

import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const user = await requireAuth();

  return <DashboardContent userName={user.name || "there"} />;
}
