import { createFileRoute } from "@tanstack/react-router";
import { ServiceModulePage } from "@/components/service-module";

export const Route = createFileRoute("/_authed/outsourced-accounting")({
  head: () => ({
    meta: [
      { title: "Outsourced Accounting | G.K Nahashon & Company" },
      { name: "description", content: "Outsourced accounting engagements — clients, work in progress, billing and documentation." },
    ],
  }),
  component: () => (
    <ServiceModulePage
      moduleKey="outsourced_accounting"
      moduleLabel="Outsourced Accounting"
      tagline="Outsourced bookkeeping & accounting engagements — clients, work in progress, billing and documentation."
    />
  ),
});
