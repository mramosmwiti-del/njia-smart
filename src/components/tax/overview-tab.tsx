import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ChecklistCell } from "./checklist-cells";
import { todayISO } from "./tax-utils";
import type { TaxCtx } from "./use-tax-page";

export function OverviewTab({ ctx }: { ctx: TaxCtx }) {
  const { returns, clients, documentsByReturn, expandedType, overviewFilter, setOverviewFilter, activePolicies, renderMissing, pickOverview, goToFiledRecord, summary, obligationMap, staffMap, currentReturn, downloadReceipt } = ctx;
  return (
    <>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Click a tax type to list its clients below. Click its open, overdue or filed figure to narrow the list.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {summary.length === 0 && (
              <div className="col-span-full bg-card border rounded-lg p-8 text-center text-muted-foreground text-sm">
                No active tax policies yet. Ask an admin to configure one under Settings.
              </div>
            )}
            {summary.map(s => {
              const expanded = expandedType === s.tax_type;
              const stop = (e: React.MouseEvent) => e.stopPropagation();
              return (
                <div
                  key={s.tax_type}
                  role="button"
                  tabIndex={0}
                  onClick={() => pickOverview(s.tax_type, "all")}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickOverview(s.tax_type, "all"); } }}
                  className={`text-left bg-card border rounded-lg p-3 transition cursor-pointer hover:border-primary/60 hover:shadow-sm ${expanded ? "ring-2 ring-primary border-primary" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{s.label}</span>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground whitespace-nowrap">
                      <span className="capitalize">{s.cadence} · due {s.due_day}</span>
                      {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </div>
                  </div>
                  <button type="button" onClick={e => { stop(e); pickOverview(s.tax_type, "open"); }} className="block text-2xl font-bold mt-1 hover:text-primary">{s.open}</button>
                  <div className="text-xs text-muted-foreground">
                    <button type="button" onClick={e => { stop(e); pickOverview(s.tax_type, "open"); }} className="hover:underline">open</button>
                    {" · "}{s.obligated} client{s.obligated === 1 ? "" : "s"} obligated
                    {s.overdue > 0 && <span className="text-destructive"> · <button type="button" onClick={e => { stop(e); pickOverview(s.tax_type, "overdue"); }} className="hover:underline">{s.overdue} overdue</button></span>}
                  </div>
                  <button type="button" onClick={e => { stop(e); pickOverview(s.tax_type, "filed"); }} className="text-xs text-muted-foreground hover:underline">{s.filed} filed — view</button>
                </div>
              );
            })}
          </div>

          {expandedType && (() => {
            const pol = activePolicies.find(p => p.tax_type === expandedType);
            const sum = summary.find(x => x.tax_type === expandedType);
            if (!pol || !sum) return null;
            const today = todayISO();
            const clientById = new Map<string, any>(clients.map((c: any) => [c.id, c]));
            const typeReturns = returns.filter((r: any) => r.return_type === pol.tax_type);
            const panelRows: { key: string; client: any; row: any | null }[] =
              overviewFilter === "all"
                ? clients
                    .filter((c: any) => obligationMap.get(`${c.id}:${pol.tax_type}`))
                    .map((c: any) => ({ key: c.id, client: c, row: currentReturn(c.id, pol.tax_type) }))
                : typeReturns
                    .filter((r: any) => overviewFilter === "filed"
                      ? r.status === "filed"
                      : r.status !== "filed" && (overviewFilter === "open" || (r.due_date && r.due_date < today)))
                    .sort((a: any, b: any) => overviewFilter === "filed"
                      ? String(b.filed_at ?? b.due_date ?? "").localeCompare(String(a.filed_at ?? a.due_date ?? ""))
                      : String(a.due_date ?? "").localeCompare(String(b.due_date ?? "")))
                    .map((r: any) => ({ key: r.id, client: clientById.get(r.client_id), row: r }));
            const chips = [
              { v: "all" as const, label: "All obligated", n: sum.obligated },
              { v: "open" as const, label: "Open", n: sum.open },
              { v: "overdue" as const, label: "Overdue", n: sum.overdue },
              { v: "filed" as const, label: "Filed", n: sum.filed },
            ];
            return (
              <div className="bg-card border rounded-lg overflow-hidden">
                <div className="px-3 py-2 border-b flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-medium">{pol.label} — {panelRows.length} {overviewFilter === "all" ? "obligated client" : overviewFilter + " return"}{panelRows.length === 1 ? "" : "s"}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {chips.map(c => (
                      <button key={c.v} type="button" onClick={() => setOverviewFilter(c.v)}
                        className={`h-7 px-2.5 rounded-full border text-xs ${overviewFilter === c.v ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:border-primary/50"}`}>
                        {c.label} ({c.n})
                      </button>
                    ))}
                    <button type="button" onClick={() => goToFiledRecord(pol.tax_type)} className="text-xs text-primary hover:underline whitespace-nowrap">Filed documents →</button>
                    <Link to="/tax/$type" params={{ type: pol.tax_type }} search={{ status: overviewFilter === "all" ? undefined : overviewFilter }} className="text-xs text-primary hover:underline whitespace-nowrap">Open full page →</Link>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs text-muted-foreground border-b">
                    <tr><th className="py-2 px-3">Client</th><th className="py-2 px-3">Filing</th><th className="py-2 px-3">Filed documents</th></tr>
                  </thead>
                  <tbody>
                    {panelRows.length === 0 && (
                      <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">
                        {overviewFilter === "all" ? `No clients are obligated for ${pol.label} yet — set this up under the Checklist tab.` : `No ${overviewFilter} ${pol.label} returns.`}
                      </td></tr>
                    )}
                    {panelRows.map(({ key, client, row }) => {
                      const docs = row ? (documentsByReturn.get(row.id) ?? []) : [];
                      return (
                        <tr key={key} className="border-b last:border-0 hover:bg-muted/20 align-top">
                          <td className="py-1.5 px-3 font-medium">{client?.company_name ?? "—"}</td>
                          <td className="py-1.5 px-3">
                            {!row ? (
                              renderMissing(client?.id, pol.tax_type)
                            ) : (
                              <Link to="/tax/$type" params={{ type: pol.tax_type }} search={{ client: client?.id }} className="inline-block hover:opacity-80">
                                <ChecklistCell row={row} cadence={pol.cadence} assigneeName={row.assigned_to ? staffMap.get(row.assigned_to) : null} />
                              </Link>
                            )}
                          </td>
                          <td className="py-1.5 px-3">
                            {docs.map((doc: any) => (
                              <button key={doc.id} type="button" onClick={() => downloadReceipt(doc.file_path)} className="flex items-start gap-1 text-left text-[11px] text-primary hover:underline max-w-full" title={doc.title}>
                                <FileText className="mt-0.5 h-3 w-3 shrink-0" /><span className="break-all">{doc.title || "Filing receipt"}</span>
                              </button>
                            ))}
                            {row?.status === "filed" ? (
                              <button type="button" onClick={() => goToFiledRecord(pol.tax_type, client?.company_name)} className="mt-1 text-[11px] text-muted-foreground hover:text-primary hover:underline">
                                {docs.length ? "Open in Filing Record →" : "No receipt on file — open Filing Record →"}
                              </button>
                            ) : (
                              !docs.length && <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
    </>
  );
}
