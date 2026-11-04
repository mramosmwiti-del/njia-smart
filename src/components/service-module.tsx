import { useServiceModule } from "./service-module/use-service-module";
import { ModuleHeader } from "./service-module/module-header";
import { ProjectsSection } from "./service-module/projects-section";
import { ClientsSection } from "./service-module/clients-section";
import { BillingSection } from "./service-module/billing-section";
import { DocumentsSection } from "./service-module/documents-section";
import { ProjectDialog } from "./service-module/project-dialog";
import { MilestoneEditor } from "./service-module/milestone-editor";
import { PreviewModal } from "./service-module/preview-modal";
import type { ServiceModuleProps } from "./service-module/constants";

export type { ServiceModuleKey } from "./service-module/constants";
export { CLIENT_ENGAGEMENT_STAGES } from "./service-module/constants";

// Thin shell: state and data live in use-service-module; each tab, dialog and
// the milestone workspace is its own component under ./service-module/.
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
