import { createFileRoute } from "@tanstack/react-router";
import { ServiceModulePage } from "@/components/service-module";
import { IctDashboard } from "@/components/ict/ict-dashboard";
import { ICT_GENERAL_TEMPLATE, ICT_PROJECT_TEMPLATES } from "@/components/ict/ict-project-templates";

export const Route = createFileRoute("/_authed/ict")({
  head: () => ({
    meta: [
      { title: "ICT | G.K Nahashon & Company" },
      { name: "description", content: "ICT projects, clients, billing and documentation." },
    ],
  }),
  component: () => (
    <div className="space-y-6">
      <IctDashboard />
      <ServiceModulePage
      moduleKey="ict"
      moduleLabel="ICT"
      tagline="ICT projects and support engagements — clients, work in progress, billing and documentation."
      projectTemplates={[ICT_GENERAL_TEMPLATE, ...ICT_PROJECT_TEMPLATES]}
      />
    </div>
  ),
});
