import { kenyaPrivateFinancialAuditV1 } from "./packs/kenya-private-financial-audit-v1";
import type { AuditEngagementKind, AuditProcedurePack, AuditProcedureSection } from "./types";

/** Local bootstrap registry. A later phase can resolve database-managed packs through the same API. */
const registeredPacks: readonly AuditProcedurePack[] = [kenyaPrivateFinancialAuditV1];

export function listAuditProcedurePacks(): AuditProcedurePack[] {
  return registeredPacks.filter((pack) => pack.status === "active");
}

export function getAuditProcedurePack(
  packId: string,
  version?: number,
): AuditProcedurePack | undefined {
  return registeredPacks.find(
    (pack) => pack.id === packId && (version === undefined || pack.version === version),
  );
}

export function getDefaultAuditProcedurePack(
  engagementKind: AuditEngagementKind = "private_financial_statement_audit",
): AuditProcedurePack | undefined {
  return registeredPacks.find(
    (pack) => pack.engagementKind === engagementKind && pack.status === "active",
  );
}

export function getAuditWorkspaceSections(
  packId = "ke-private-financial-audit",
  version?: number,
): AuditProcedureSection[] {
  return (getAuditProcedurePack(packId, version)?.sections ?? [])
    .filter((section) => section.enabled)
    .slice()
    .sort((a, b) => a.order - b.order);
}
