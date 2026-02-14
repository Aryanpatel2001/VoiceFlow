/**
 * Contacts Page
 *
 * Manage reusable contact lists.
 */

import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { ContactsContent } from "@/components/contacts/contacts-content";

export const metadata: Metadata = {
  title: "Contacts",
  description: "Manage your contact lists",
};

export default async function ContactsPage() {
  await requireAuth();
  return <ContactsContent />;
}
