import type { AuditProcedurePack } from "../types";

/**
 * Starter metadata only. This is a workflow scaffold, not a substitute for
 * licensed standards text, firm methodology, or practitioner judgment.
 */
export const kenyaPrivateFinancialAuditV1: AuditProcedurePack = {
  id: "ke-private-financial-audit",
  version: 1,
  title: "Kenya — Private-sector financial statement audit",
  description:
    "Starter ISA-based workflow pack for private-sector financial statement audits in Kenya. Firm methodology and current local requirements must be reviewed before professional use.",
  jurisdiction: "KE",
  engagementKind: "private_financial_statement_audit",
  standardsBasis: ["ISA", "IESBA Code", "Kenyan company and sector-specific law, where applicable"],
  effectiveFrom: "2026-10-09",
  status: "active",
  sections: [
    { id: "planning", label: "Audit planning", description: "Acceptance, independence, terms, strategy and materiality.", order: 10, enabled: true },
    { id: "risk", label: "Risk assessment", description: "Understand the entity, assess risks and document responses.", order: 20, enabled: true },
    { id: "programs", label: "Audit programs", description: "Design and perform procedures responsive to assessed risks.", order: 30, enabled: true },
    { id: "working_papers", label: "Working papers", description: "Document work performed and link supporting evidence.", order: 40, enabled: true },
    { id: "sampling", label: "Sampling", description: "Document populations, selection methods and evaluation of exceptions.", order: 50, enabled: true },
    { id: "financial_statements", label: "Financial statements", description: "Evaluate balances, disclosures and misstatements.", order: 60, enabled: true },
    { id: "review_notes", label: "Review notes", description: "Resolve review points and document review outcomes.", order: 70, enabled: true },
    { id: "completion", label: "Completion tracking", description: "Completion procedures, final evaluations and sign-off readiness.", order: 80, enabled: true },
    { id: "final_report", label: "Final audit report", description: "Report type, opinion, approval and release controls.", order: 90, enabled: true },
  ],
  procedures: [
    {
      id: "acceptance-continuance", packId: "ke-private-financial-audit", version: 1,
      title: "Acceptance and continuance", objective: "Document acceptance or continuance considerations and approval.", sectionId: "planning",
      standardReferences: ["ISA 220 (Revised)", "IESBA Code"], required: true, enabled: true, dependencies: [],
      requiredFields: ["decision", "assessment", "approvedBy"], expectedEvidence: ["Acceptance/continuance assessment", "Approval record"],
      completionRules: { requireConclusion: true, requireEvidence: true, requireReviewerWhenRequired: true },
    },
    {
      id: "independence-ethics", packId: "ke-private-financial-audit", version: 1,
      title: "Independence and ethics", objective: "Record relevant independence confirmations and threats/safeguards.", sectionId: "planning",
      standardReferences: ["IESBA Code", "ISA 220 (Revised)"], required: true, enabled: true, dependencies: ["acceptance-continuance"],
      requiredFields: ["teamDeclarations", "threatsAndSafeguards", "conclusion"], expectedEvidence: ["Team declarations", "Threats and safeguards assessment"],
      completionRules: { requireConclusion: true, requireEvidence: true, requireReviewerWhenRequired: true },
    },
    {
      id: "engagement-terms", packId: "ke-private-financial-audit", version: 1,
      title: "Agree engagement terms", objective: "Document the agreed terms and responsibilities for the engagement.", sectionId: "planning",
      standardReferences: ["ISA 210"], required: true, enabled: true, dependencies: ["acceptance-continuance"],
      requiredFields: ["termsDate", "responsibilities", "approval"], expectedEvidence: ["Signed engagement letter or equivalent record"],
      completionRules: { requireConclusion: true, requireEvidence: true, requireReviewerWhenRequired: true },
    },
    {
      id: "entity-understanding-risk", packId: "ke-private-financial-audit", version: 1,
      title: "Understand entity and assess risks", objective: "Identify and assess risks of material misstatement at financial statement and assertion levels.", sectionId: "risk",
      standardReferences: ["ISA 315 (Revised 2019)"], required: true, enabled: true, dependencies: ["engagement-terms"],
      requiredFields: ["entityUnderstanding", "riskAssessments", "significantRisks"], expectedEvidence: ["Risk assessment documentation", "Relevant process/control understanding"],
      completionRules: { requireConclusion: true, requireEvidence: true, requireReviewerWhenRequired: true },
    },
    {
      id: "materiality", packId: "ke-private-financial-audit", version: 1,
      title: "Determine materiality", objective: "Document materiality judgments and the basis for amounts selected.", sectionId: "planning",
      standardReferences: ["ISA 320"], required: true, enabled: true, dependencies: ["entity-understanding-risk"],
      requiredFields: ["benchmark", "overallMateriality", "performanceMateriality", "basis"], expectedEvidence: ["Materiality calculation and rationale"],
      completionRules: { requireConclusion: true, requireEvidence: true, requireReviewerWhenRequired: true },
    },
    {
      id: "responses-to-risk", packId: "ke-private-financial-audit", version: 1,
      title: "Design responses to assessed risks", objective: "Link planned procedures to assessed risks and assertions.", sectionId: "programs",
      standardReferences: ["ISA 330", "ISA 315 (Revised 2019)"], required: true, enabled: true, dependencies: ["entity-understanding-risk", "materiality"],
      requiredFields: ["riskLinks", "plannedProcedures", "timingAndExtent"], expectedEvidence: ["Risk-to-procedure mapping", "Approved audit program"],
      completionRules: { requireConclusion: true, requireEvidence: true, requireReviewerWhenRequired: true },
    },
    {
      id: "audit-evidence", packId: "ke-private-financial-audit", version: 1,
      title: "Evaluate audit evidence", objective: "Document procedures performed, evidence obtained, exceptions and conclusions.", sectionId: "working_papers",
      standardReferences: ["ISA 500", "ISA 230"], required: true, enabled: true, dependencies: ["responses-to-risk"],
      requiredFields: ["workPerformed", "evidenceReferences", "exceptions", "conclusion"], expectedEvidence: ["Cross-referenced workpapers and source evidence"],
      completionRules: { requireConclusion: true, requireEvidence: true, requireReviewerWhenRequired: true },
    },
    {
      id: "misstatements", packId: "ke-private-financial-audit", version: 1,
      title: "Evaluate identified misstatements", objective: "Accumulate and evaluate misstatements and document disposition.", sectionId: "financial_statements",
      standardReferences: ["ISA 450"], required: true, enabled: true, dependencies: ["audit-evidence"],
      requiredFields: ["misstatementSchedule", "correctedStatus", "uncorrectedEvaluation"], expectedEvidence: ["Misstatement schedule", "Management communication where applicable"],
      completionRules: { requireConclusion: true, requireEvidence: true, requireReviewerWhenRequired: true },
    },
    {
      id: "completion-and-report", packId: "ke-private-financial-audit", version: 1,
      title: "Completion and reporting", objective: "Document completion matters and the basis for the auditor's report.", sectionId: "completion",
      standardReferences: ["ISA 560", "ISA 570", "ISA 580", "ISA 700"], required: true, enabled: true, dependencies: ["misstatements"],
      requiredFields: ["subsequentEvents", "goingConcern", "writtenRepresentations", "reportConclusion"], expectedEvidence: ["Completion checklist", "Written representations", "Approved report"],
      completionRules: { requireConclusion: true, requireEvidence: true, requireReviewerWhenRequired: true },
    },
  ],
};
