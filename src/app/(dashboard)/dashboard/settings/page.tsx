/**
 * Settings Page
 *
 * User and organization settings.
 */

import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { SettingsContent } from "@/components/settings/settings-content";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  await requireAuth();

  return <SettingsContent />;
}
