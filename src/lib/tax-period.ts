/**
 * Filing-window helpers for the Tax module.
 *
 * A filing period "opens" on the 1st of the month its due date falls in
 * (annual returns: 1 Jan of the due date's year). Until then the return is
 * waiting for its cycle and cannot be marked filed.
 *
 * MUST stay in sync with public.tax_return_open_date() in
 * supabase/migrations/20261026090000_tax_one_filing_per_period.sql —
 * the database is the real enforcement; this file only drives the UI.
 */

/** Today's date (YYYY-MM-DD) in Nairobi, independent of the browser's timezone. */
export function todayNairobi(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date());
}

/** First day (YYYY-MM-DD) on which this period may be filed, or null if no due date. */
export function filingOpenDate(dueDate?: string | null, cadence?: string | null): string | null {
  if (!dueDate) return null;
  const [y, m] = dueDate.slice(0, 10).split("-");
  if (!y || !m) return null;
  return cadence === "annual" ? `${y}-01-01` : `${y}-${m}-01`;
}

/** True once the period's filing window has opened (or if there is no due date to wait on). */
export function isFilingOpen(dueDate?: string | null, cadence?: string | null): boolean {
  const open = filingOpenDate(dueDate, cadence);
  return !open || todayNairobi() >= open;
}
