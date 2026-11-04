// Shared constants, types and helpers for the ICT Service Desk.

export const CATEGORIES = ["Hardware", "Software", "Network", "Access/Account", "Other"];
export const PRIORITIES = ["Low", "Medium", "High", "Critical"];
export const STATUSES = ["New", "In Progress", "On Hold", "Resolved", "Closed"];
export const EMPTY_FORM = { title: "", description: "", category: CATEGORIES[0], priority: "Medium", assigned_to: "", service_type: "general" };
export const EMPTY_ASSET_FORM = { id: "", name: "", description: "", quantity: "1", unit_cost: "", purchase_date: "", assigned_to: "" };

export const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-muted text-muted-foreground",
  Medium: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  High: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  Critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

export const STATUS_COLORS: Record<string, string> = {
  New: "bg-muted text-muted-foreground",
  "In Progress": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  "On Hold": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  Resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  Closed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

export type Ticket = {
  id: string;
  ticket_number: string | null;
  title: string;
  description: string | null;
  category: string | null;
  priority: string | null;
  status: string;
  reported_by: string;
  assigned_to: string | null;
  created_at: string;
  service_type?: string | null;
};

// Service templates + per-ticket checklist (see 20261009120000_ict_service_templates.sql).
// The database enforces every rule below; this page only reflects it.
export type ServiceTemplate = { service_type: string; title: string; description: string | null; sort_order: number };
export type StepStatus = "not_started" | "in_progress" | "blocked" | "done" | "verified" | "not_applicable";
export type Control = {
  id: string;
  ticket_id: string;
  template_control_id: string | null;
  control_key: string;
  category: string;
  title: string;
  guidance: string | null;
  evidence_hint: string | null;
  mandatory: boolean;
  requires_evidence: boolean;
  requires_verification: boolean;
  sort_order: number;
  status: StepStatus;
  evidence_note: string | null;
  assigned_to: string | null;
  due_date: string | null;
  completed_by: string | null;
  completed_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
};

export const STEP_LABEL: Record<StepStatus, string> = {
  not_started: "Not started", in_progress: "In progress", blocked: "Blocked",
  done: "Done", verified: "Verified", not_applicable: "Not applicable",
};
export const STEP_COLORS: Record<StepStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  blocked: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  verified: "bg-emerald-200 text-emerald-900 dark:bg-emerald-800/50 dark:text-emerald-100",
  not_applicable: "bg-muted text-muted-foreground",
};

// A step counts as finished when it is verified, not applicable, or done and
// does not need a second person to verify it.
export const isStepComplete = (c: Control) =>
  c.status === "verified" || c.status === "not_applicable" || (c.status === "done" && !c.requires_verification);

export function progressOf(cs: Control[]) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    total: cs.length,
    complete: cs.filter(isStepComplete).length,
    awaiting: cs.filter((c) => c.status === "done" && c.requires_verification).length,
    blocked: cs.filter((c) => c.status === "blocked").length,
    overdue: cs.filter((c) => c.due_date && c.due_date < today && !isStepComplete(c)).length,
    mandatoryOpen: cs.filter((c) => c.mandatory && !isStepComplete(c)).length,
  };
}

export const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });

export type Asset = {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit_cost: number | null;
  purchase_date: string | null;
  assigned_to: string | null;
  created_at: string;
};

export type PersonLookup = (id: string | null | undefined) => string;

export type TicketForm = typeof EMPTY_FORM;
export type AssetForm = typeof EMPTY_ASSET_FORM;
