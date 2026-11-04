// Shared constants for the service-module pages (ICT, Outsourced Accounting, Payroll, FBM).

export type ServiceModuleKey =
  | "ict"
  | "outsourced_accounting"
  | "payroll_management"
  | "financial_business_management";

export const STATUSES = ["not_started", "in_progress", "under_review", "completed"];

export const DEFAULT_STAGES = [
  { key: "kickoff", label: "Kick-off" },
  { key: "information", label: "Information gathering" },
  { key: "analysis", label: "Analysis & setup" },
  { key: "draft", label: "Draft deliverable" },
  { key: "review", label: "Internal review" },
  { key: "signoff", label: "Client sign-off" },
  { key: "closed", label: "Closed" },
];

// Onboard client -> collect requirements -> define scope -> assign staff ->
// monitor progress & record activity -> invoicing -> closing. Used by
// Outsourced Accounting, Payroll Management and Financial Business

export const CLIENT_ENGAGEMENT_STAGES = [
  { key: "onboarding", label: "Onboarding" },
  { key: "requirements", label: "Requirements" },
  { key: "scope", label: "Scope" },
  { key: "assignment", label: "Assignment" },
  { key: "monitoring", label: "Monitoring" },
  { key: "invoicing", label: "Invoicing" },
  { key: "closed", label: "Closed" },
];
export const MILESTONE_SELECT = "id, title, due_date, done, notes, assigned_to, stage, completed_at, verified, verified_by, verified_at";
export const PROJECT_SELECT = `*, clients(company_name), service_milestones(${MILESTONE_SELECT})`;


export function fmtDateTime(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export type ProjectTemplate = { serviceType: string; label: string; description: string; milestones: { title: string; stage: string }[] };

export type ServiceModuleProps = {
  moduleKey: ServiceModuleKey;
  moduleLabel: string;
  tagline: string;
  stages?: { key: string; label: string }[];
  projectTemplates?: ProjectTemplate[];
};
