/**
 * Contact List Detail Page
 *
 * View and manage contacts in a list.
 */

import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { ContactListDetailContent } from "@/components/contacts/contact-list-detail-content";

export const metadata: Metadata = {
  title: "Contact List",
  description: "View and manage contacts in this list",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContactListDetailPage({ params }: PageProps) {
  await requireAuth();
  const { id } = await params;
  return <ContactListDetailContent listId={id} />;
}
