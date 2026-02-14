/**
 * Team Management Page
 *
 * Manage organization team members.
 */

import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { TeamContent } from "@/components/team/team-content";

export const metadata: Metadata = {
  title: "Team",
};

export default async function TeamPage() {
  await requireAuth();

  return <TeamContent />;
}
