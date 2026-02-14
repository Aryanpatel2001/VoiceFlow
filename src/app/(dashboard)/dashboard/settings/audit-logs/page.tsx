/**
 * Audit Logs Page
 *
 * Shows organization activity and audit trail.
 */

import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { AuditLogsContent } from "@/components/settings/audit-logs-content";

export const metadata: Metadata = {
  title: "Audit Logs",
};

export default async function AuditLogsPage() {
  await requireAuth();

  return <AuditLogsContent />;
}
