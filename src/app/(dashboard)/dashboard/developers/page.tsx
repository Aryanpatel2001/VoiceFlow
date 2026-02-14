/**
 * API Documentation Page
 *
 * Developer portal with API reference and documentation.
 */

import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { ApiDocsContent } from "@/components/developers/api-docs-content";

export const metadata: Metadata = {
  title: "API Documentation",
};

export default async function DevelopersPage() {
  await requireAuth();

  return <ApiDocsContent />;
}
