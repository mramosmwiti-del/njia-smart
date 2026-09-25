import { createFileRoute } from "@tanstack/react-router";
import { ServiceModulePage, CLIENT_ENGAGEMENT_STAGES } from "@/components/service-module";

export const Route = createFileRoute("/_authed/outsourced-accounting")({
  head: () => ({
    meta: [
      { title: "Outsourced Accounting | G.K Nahashon & Company" },
      { name: "description", content: "Outsourced accounting engagements — clients, work in progress, billing and documentation." },
    ],
  }),
  component: () => (
    <ServiceModulePage
      stages={CLIENT_ENGAGEMENT_STAGES}
      moduleKey="outsourced_accounting"
      moduleLabel="Outsourced Accounting"
      tagline="Outsourced bookkeeping & accounting engagements — clients, work in progress, billing and documentation."
    />
  ),
});
