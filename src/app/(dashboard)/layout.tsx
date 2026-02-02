/**
 * Dashboard Layout
 *
 * Protected layout for all dashboard pages.
 * Includes sidebar navigation and header.
 * Redirects unauthenticated users to login.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.organizationId) {
    redirect("/onboarding");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
