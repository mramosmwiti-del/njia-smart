import { createFileRoute } from "@tanstack/react-router";
import { ServiceModulePage } from "@/components/service-module";

export const Route = createFileRoute("/_authed/ict")({
  head: () => ({
    meta: [
      { title: "ICT | G.K Nahashon & Company" },
      { name: "description", content: "ICT projects, clients, billing and documentation." },
    ],
  }),
  component: () => (
    <ServiceModulePage
      moduleKey="ict"
      moduleLabel="ICT"
      tagline="ICT projects and support engagements — clients, work in progress, billing and documentation."
    />
  ),
});
