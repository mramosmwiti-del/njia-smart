import { Check } from "lucide-react";
import { todayNairobi } from "@/lib/tax-period";
import type { TaxCtx } from "./use-tax-page";

export function AnnualTab({ ctx }: { ctx: TaxCtx }) {
  const { clientFilter, setClientFilter, annualYear, setAnnualYear, annualType, setAnnualType, activePolicies, annualFilingRows, annualMonths, annualMonthStatus } = ctx;
  return (
    <>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div>
              <label className="text-xs font-medium text-muted-foreground mr-2">Year</label>
              <select value={annualYear} onChange={e => setAnnualYear(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm">
                {Array.from({ length: 7 }, (_, index) => String(Number(todayNairobi().slice(0, 4)) - 3 + index)).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mr-2">Tax type</label>
              <select value={annualType} onChange={e => setAnnualType(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm min-w-[180px]">
                <option value="">All types</option>
                {activePolicies.map(policy => <option key={policy.tax_type} value={policy.tax_type}>{policy.label}</option>)}
              </select>
            </div>
            <input placeholder="Filter clients…" value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="h-9 w-64 px-3 rounded-md border bg-background text-sm" />
          </div>

          <div className="bg-card border rounded-lg max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[820px] table-fixed text-xs">
              <thead className="bg-muted text-left text-xs text-muted-foreground border-b">
                <tr>
                  <th className="sticky top-0 left-0 z-40 w-[110px] bg-muted py-1.5 px-1.5 whitespace-normal break-words">Client</th>
                  <th className="sticky top-0 z-30 w-[135px] bg-muted py-1.5 px-1.5 whitespace-normal break-words">Obligation</th>
                  {annualMonths.map(month => <th key={month.key} className="sticky top-0 z-30 w-[48px] bg-muted py-1.5 px-0.5 text-center whitespace-normal break-words">{month.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {annualFilingRows.length === 0 && <tr><td colSpan={14} className="py-8 text-center text-muted-foreground">No client obligations match this year and filter.</td></tr>}
                {annualFilingRows.map(row => (
                  <tr key={row.key} className="border-b last:border-0 hover:bg-muted/20 align-top">
                    <td className="py-1.5 px-1.5 font-medium sticky left-0 z-10 bg-card whitespace-normal break-words align-top">{row.client.company_name}</td>
                    <td className="py-1.5 px-1.5 text-[11px] align-top">
                      <div className="space-y-1.5">
                        {row.obligations.map(obligation => (
                          <div key={obligation.key} className="min-h-6 whitespace-normal break-words font-medium">{obligation.label}</div>
                        ))}
                      </div>
                    </td>
                    {annualMonths.map(month => (
                      <td key={month.key} className="py-1.5 px-0.5 text-center align-top">
                        <div className="space-y-1.5">
                          {row.obligations.map(obligation => {
                            const status = annualMonthStatus(obligation.months.get(month.key));
                            return (
                              <div key={obligation.key} className="min-h-6 flex items-center justify-center">
                                {status ? (
                                  <span className={`inline-flex max-w-full whitespace-normal break-words items-center justify-center gap-0 rounded-full px-0.5 py-0.5 text-[9px] leading-tight ${status === "Filed" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-100"}`}>
                                    {status === "Filed" && <Check className="h-2.5 w-2.5 shrink-0" />}{status}
                                  </span>
                                ) : <span className="text-muted-foreground">—</span>}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Each row represents one client. All applicable obligations are listed together, and monthly statuses follow the same obligation order; months without a filing record are shown as —.</p>
        </div>
    </>
  );
}
