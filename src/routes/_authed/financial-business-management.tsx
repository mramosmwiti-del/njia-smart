import { createFileRoute } from "@tanstack/react-router";
import { ServiceModulePage, CLIENT_ENGAGEMENT_STAGES } from "@/components/service-module";

export const Route = createFileRoute("/_authed/financial-business-management")({
  head: () => ({
    meta: [
      { title: "Financial Business Management | G.K Nahashon & Company" },
      { name: "description", content: "Financial business management engagements — clients, work in progress, billing and documentation." },
    ],
  }),
  component: () => (
    <ServiceModulePage
      stages={CLIENT_ENGAGEMENT_STAGES}
      moduleKey="financial_business_management"
      moduleLabel="Financial Business Management"
      tagline="Financial and business management advisory — clients, work in progress, billing and documentation."
    />
  ),
});
