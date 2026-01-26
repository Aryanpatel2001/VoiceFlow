/**
 * Auth Layout
 *
 * Layout for authentication pages (login, signup, etc.)
 * Redirects authenticated users to dashboard.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if user is already logged in
  const session = await getSession();

  if (session?.user) {
    // If user has no organization, redirect to onboarding
    if (!session.user.organizationId) {
      redirect("/onboarding");
    }
    // Otherwise redirect to dashboard
    redirect("/dashboard");
  }

  return <>{children}</>;
}
