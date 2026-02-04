/**
 * Test Call Page
 *
 * Browser-based test call interface for testing AI voice agents.
 */

import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { TestCallInterface } from "@/components/voice/test-call-interface";

export const metadata: Metadata = {
  title: "Test Call",
};

export default async function TestCallPage() {
  await requireAuth();

  return <TestCallInterface />;
}
