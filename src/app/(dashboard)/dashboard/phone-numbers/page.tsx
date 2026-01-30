/**
 * Phone Numbers Page
 *
 * Manage phone numbers, assign flows, and configure Twilio integration.
 */

import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { PhoneNumbersContent } from "@/components/phone-numbers/phone-numbers-content";

export const metadata: Metadata = {
  title: "Phone Numbers",
};

export default async function PhoneNumbersPage() {
  await requireAuth();

  return <PhoneNumbersContent />;
}
