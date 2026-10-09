/**
 * Invoice service lines. The database stores ONE canonical spelling (the
 * display label) and normalizes every write via normalize_service_line().
 * Keep the labels here identical to that SQL function.
 */
export const SERVICE_LINE_BY_MODULE: Record<string, string> = {
  ict: "ICT",
  outsourced_accounting: "Outsourced Accounting",
  payroll_management: "Payroll Management",
  financial_business_management: "Financial Business Management",
};

/** Canonical service-line label for a module key (or an already-labelled value). */
export function serviceLineFor(moduleKeyOrLabel: string): string {
  return SERVICE_LINE_BY_MODULE[moduleKeyOrLabel] ?? moduleKeyOrLabel;
}
