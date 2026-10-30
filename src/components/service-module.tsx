import { useServiceModule } from "@/components/service-module/use-service-module";
import { ModuleHeader } from "@/components/service-module/module-header";
import { ProjectsSection } from "@/components/service-module/projects-section";
import { ClientsSection } from "@/components/service-module/clients-section";
import { BillingSection } from "@/components/service-module/billing-section";
import { DocumentsSection } from "@/components/service-module/documents-section";
import { ProjectDialog } from "@/components/service-module/project-dialog";
import { MilestoneEditor } from "@/components/service-module/milestone-editor";
import { PreviewModal } from "@/components/service-module/preview-modal";
import type { ServiceModuleProps } from "@/components/service-module/constants";

// Public surface kept so existing pages (ICT, Outsourced Accounting, Payroll,
// Financial Business Management) keep importing from "@/components/service-module".
export { CLIENT_ENGAGEMENT_STAGES } from "@/components/service-module/constants";
export type { ServiceModuleKey } from "@/components/service-module/constants";

// Shared page for every "service module": projects, milestones, clients, billing
// and documents. State and actions live in use-service-module; each section is
// its own component under components/service-module/.
export function ServiceModulePage(props: ServiceModuleProps) {
  const ctx = useServiceModule(props);
  return (
    <div className="space-y-4" ref={ctx.topRef}>
      <ModuleHeader ctx={ctx} />
      <ProjectsSection ctx={ctx} />
      <ClientsSection ctx={ctx} />
      <BillingSection ctx={ctx} />
      <DocumentsSection ctx={ctx} />
      <ProjectDialog ctx={ctx} />
      <MilestoneEditor ctx={ctx} />
      <PreviewModal ctx={ctx} />
    </div>
  );
}
