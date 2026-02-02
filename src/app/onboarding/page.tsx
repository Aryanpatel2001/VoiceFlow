/**
 * Onboarding Page
 *
 * Collects organization details from new users.
 * Redirects to /login if not authenticated.
 * Redirects to /dashboard if already has an organization.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Metadata } from "next";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export const metadata: Metadata = {
  title: "Set Up Your Organization",
};

export default async function OnboardingPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.organizationId) {
    redirect("/dashboard");
  }

  return <OnboardingForm userName={session.user.name || "there"} />;
}
