import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { IntegrationsContent } from "@/components/integrations/integrations-content";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Connect third-party services to enhance your voice agents",
};

export default async function IntegrationsPage() {
  await requireAuth();
  return <IntegrationsContent />;
}
