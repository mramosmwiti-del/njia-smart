import type {
  AuditProcedureDefinition,
  AuditProcedurePack,
  AuditProcedureResultInput,
  AuditProcedureStatus,
  AuditValidationIssue,
} from "./types";

export function getApplicableProcedures(pack: AuditProcedurePack): AuditProcedureDefinition[] {
  return pack.procedures.filter((procedure) => procedure.enabled);
}

export function validateProcedureResult(
  procedure: AuditProcedureDefinition,
  result: AuditProcedureResultInput,
): AuditValidationIssue[] {
  const issues: AuditValidationIssue[] = [];
  const completedLike: AuditProcedureStatus[] = ["prepared", "under_review", "completed"];

  if (!completedLike.includes(result.status)) return issues;

  if (procedure.completionRules.requireConclusion && !result.conclusion?.trim()) {
    issues.push({
      code: "conclusion_required",
      message: `Add a conclusion before completing “${procedure.title}”.`,
      field: "conclusion",
      procedureId: procedure.id,
    });
  }

  if (procedure.completionRules.requireEvidence && !(result.evidenceIds?.length)) {
    issues.push({
      code: "evidence_required",
      message: `Link supporting evidence before completing “${procedure.title}”.`,
      field: "evidenceIds",
      procedureId: procedure.id,
    });
  }

  if (procedure.completionRules.requireReviewerWhenRequired && procedure.required && !result.reviewerId) {
    issues.push({
      code: "reviewer_required",
      message: `Assign a reviewer before completing required procedure “${procedure.title}”.`,
      field: "reviewerId",
      procedureId: procedure.id,
    });
  }

  return issues;
}

/** Returns dependencies that have not reached completed or not-applicable status. */
export function getUnmetDependencies(
  procedure: AuditProcedureDefinition,
  statuses: Readonly<Record<string, AuditProcedureStatus | undefined>>,
): string[] {
  return procedure.dependencies.filter((dependencyId) => {
    const status = statuses[dependencyId];
    return status !== "completed" && status !== "not_applicable";
  });
}

export function canStartProcedure(
  procedure: AuditProcedureDefinition,
  statuses: Readonly<Record<string, AuditProcedureStatus | undefined>>,
): boolean {
  return procedure.enabled && getUnmetDependencies(procedure, statuses).length === 0;
}

export function getEngagementReadiness(
  pack: AuditProcedurePack,
  statuses: Readonly<Record<string, AuditProcedureStatus | undefined>>,
): { ready: boolean; incompleteRequiredProcedureIds: string[] } {
  const incompleteRequiredProcedureIds = getApplicableProcedures(pack)
    .filter((procedure) => procedure.required)
    .filter((procedure) => statuses[procedure.id] !== "completed" && statuses[procedure.id] !== "not_applicable")
    .map((procedure) => procedure.id);

  return {
    ready: incompleteRequiredProcedureIds.length === 0,
    incompleteRequiredProcedureIds,
  };
}
