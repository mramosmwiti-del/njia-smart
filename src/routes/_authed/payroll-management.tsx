import { createFileRoute } from "@tanstack/react-router";
import { ServiceModulePage } from "@/components/service-module";

export const Route = createFileRoute("/_authed/payroll-management")({
  head: () => ({
    meta: [
      { title: "Payroll Management | G.K Nahashon & Company" },
      { name: "description", content: "Payroll management engagements — clients, work in progress, billing and documentation." },
    ],
  }),
  component: () => (
    <ServiceModulePage
      moduleKey="payroll_management"
      moduleLabel="Payroll Management"
      tagline="Client payroll runs and compliance — clients, work in progress, billing and documentation."
    />
  ),
});
