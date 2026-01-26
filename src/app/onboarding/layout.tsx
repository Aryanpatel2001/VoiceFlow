/**
 * Onboarding Layout
 *
 * Wraps the onboarding page with SessionProvider
 * so client components can access the session.
 */

"use client";

import { SessionProvider } from "next-auth/react";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
