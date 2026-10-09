/**
 * Shared, configuration-first types for the audit workflow.
 * Keep procedure content declarative: packs must never execute arbitrary code.
 */

export type AuditEngagementKind = "private_financial_statement_audit";
export type AuditProcedureStatus =
  | "not_started"
  | "in_progress"
  | "prepared"
  | "under_review"
  | "review_notes"
  | "completed"
  | "not_applicable";

export type AuditProcedureSection = {
  id: string;
  label: string;
  description: string;
  order: number;
  enabled: boolean;
};

export type AuditProcedureDefinition = {
  id: string;
  packId: string;
  version: number;
  title: string;
  objective: string;
  sectionId: string;
  standardReferences: string[];
  required: boolean;
  enabled: boolean;
  dependencies: string[];
  requiredFields: string[];
  expectedEvidence: string[];
  completionRules: {
    requireConclusion: boolean;
    requireEvidence: boolean;
    requireReviewerWhenRequired: boolean;
  };
};

export type AuditProcedurePack = {
  id: string;
  version: number;
  title: string;
  description: string;
  jurisdiction: "KE";
  engagementKind: AuditEngagementKind;
  standardsBasis: string[];
  effectiveFrom: string;
  status: "draft" | "active" | "retired";
  sections: AuditProcedureSection[];
  procedures: AuditProcedureDefinition[];
};

export type AuditProcedureResultInput = {
  status: AuditProcedureStatus;
  workPerformed?: string;
  conclusion?: string;
  evidenceIds?: string[];
  exceptionCount?: number;
  reviewerId?: string | null;
};

export type AuditValidationIssue = {
  code: string;
  message: string;
  field?: string;
  procedureId?: string;
};
