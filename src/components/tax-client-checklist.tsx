import { Fragment, useMemo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Check, Clock, Lock } from "lucide-react";
import { formatDate, periodsOverdue } from "@/lib/format";
import { filingOpenDate, isFilingOpen } from "@/lib/tax-period";

export type ChecklistClientRow = {
  client: { id: string; company_name: string };
  items: { pol: any; cur: any | null }[];
};

type State = "filed" | "overdue" | "open" | "waiting";

/** Where a client's current period for one obligation stands. */
function stateOf(cur: any | null, pol: any): State | null {
  if (!cur) return null;
  if (cur.status === "filed") return "filed";
  if (periodsOverdue(cur.due_date, pol.cadence) >= 1) return "overdue";
  if (!isFilingOpen(cur.due_date, pol.cadence)) return "waiting";
  return "open";
}

const ACCENT: Record<State, string> = {
  filed: "border-l-emerald-500",
  overdue: "border-l-red-500",
  open: "border-l-amber-400",
  waiting: "border-l-slate-300 dark:border-l-slate-600",
};

/**
 * Filing checklist: one row per client with all of that client's obligations
 * together, each showing its status, dates and assignee. Filing itself
 * (tick + File selected) is done from the Filing Record tab.
 */
export function TaxClientChecklist({
  rows, isAdmin, emptyHint, renderCell, renderMissing, onReopen, onStop, assignOpenId, renderAssignPanel,
}: {
  rows: ChecklistClientRow[];
  isAdmin: boolean;
  emptyHint: string;
  renderCell: (cur: any, pol: any) => ReactNode;
  renderMissing: (clientId: string, taxType: string) => ReactNode;
  onReopen: (returnId: string) => void;
  onStop: (clientId: string, pol: any, clientName: string) => void;
  /** Return whose inline assign panel is open (expands under the client entry). */
  assignOpenId?: string | null;
  renderAssignPanel?: (cur: any, pol: any, clientName: string) => ReactNode;
  /** No longer used (filing moved to the Filing Record tab); accepted so older callers still compile. */
  busyId?: string | null;
  onFileSelected?: (clientId: string, returnIds: string[]) => void;
}) {
  const totals = useMemo(() => {
    const t = { obligations: 0, overdue: 0, open: 0, waiting: 0, filed: 0 };
    rows.forEach(r => r.items.forEach(({ pol, cur }) => {
      t.obligations++;
      const st = stateOf(cur, pol);
      if (st) t[st]++;
    }));
    return t;
  }, [rows]);

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b">
        <p className="text-xs text-muted-foreground">
          {rows.length} client{rows.length === 1 ? "" : "s"} · {totals.obligations} obligation{totals.obligations === 1 ? "" : "s"}. Click an obligation to open that client's filings. To file, use the Filing Record tab.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-red-800 dark:bg-red-900/40 dark:text-red-200"><AlertTriangle className="h-3 w-3" /> Overdue {totals.overdue}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/30 dark:text-amber-100"><Clock className="h-3 w-3" /> To file {totals.open}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground"><Lock className="h-3 w-3" /> Not yet open {totals.waiting}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"><Check className="h-3 w-3" /> Filed {totals.filed}</span>
        </div>
      </div>

      {rows.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">{emptyHint}</div>}

      <div className="divide-y">
        {rows.map(({ client, items }) => {
          const c = { overdue: 0, open: 0, waiting: 0, filed: 0 };
          items.forEach(({ pol, cur }) => { const st = stateOf(cur, pol); if (st) c[st]++; });
          const dot = c.overdue ? "bg-red-500" : c.open ? "bg-amber-400" : c.filed && c.filed === items.length ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600";
          const summary = [
            c.overdue ? `${c.overdue} overdue` : null,
            c.open ? `${c.open} to file` : null,
            c.waiting ? `${c.waiting} not yet open` : null,
            c.filed && c.filed === items.length ? "All filed" : c.filed ? `${c.filed} filed` : null,
          ].filter(Boolean).join(" · ");

          return (
            <Fragment key={client.id}>
              <div className="group flex flex-col gap-3 px-4 py-3 hover:bg-muted/20 md:flex-row">
                <div className="md:w-56 md:shrink-0">
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
                    <div>
                      <div className="font-medium leading-tight">{client.company_name}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{summary || `${items.length} obligation${items.length === 1 ? "" : "s"}`}</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-wrap gap-2">
                  {items.map(({ pol, cur }) => {
                    const st = stateOf(cur, pol);
                    return (
                      <div key={pol.tax_type} className={`min-w-[170px] rounded-md border bg-background p-2.5 ${st ? `border-l-4 ${ACCENT[st]}` : "border-dashed"}`}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold">{pol.label}</span>
                          {isAdmin && (
                            <button type="button" onClick={() => onStop(client.id, pol, client.company_name)} className="text-[10px] text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100">Stop</button>
                          )}
                        </div>
                        {!cur ? renderMissing(client.id, pol.tax_type) : (
                          <Link to="/tax/$type" params={{ type: pol.tax_type }} search={{ client: client.id }} className="inline-block hover:opacity-80">
                            {renderCell(cur, pol)}
                          </Link>
                        )}
                        {cur && (
                          <div className="mt-1.5 border-t pt-1 text-[10px] leading-snug text-muted-foreground">
                            {cur.period_end && <div>Period ending {formatDate(cur.period_end)}</div>}
                            {st === "waiting" && <div>Opens {formatDate(filingOpenDate(cur.due_date, pol.cadence))}</div>}
                            {st !== "filed" && st !== "waiting" && cur.due_date && <div>Due {formatDate(cur.due_date)}</div>}
                            {st === "filed" && (
                              <div>
                                Closed{cur.filed_at ? ` · filed ${formatDate(cur.filed_at)}` : ""}
                                {isAdmin && <> · <button type="button" onClick={() => onReopen(cur.id)} className="underline hover:text-foreground">Reopen</button></>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {renderAssignPanel && items.map(({ pol, cur }) => cur && assignOpenId === cur.id ? (
                <div key={`assign-${cur.id}`} className="bg-muted/20 px-4 py-2">{renderAssignPanel(cur, pol, client.company_name)}</div>
              ) : null)}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
