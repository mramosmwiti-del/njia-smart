import { Fragment, useMemo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Check, CircleDashed, Clock, Lock } from "lucide-react";
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
 * Compliance checklist: one row per client, one column per tax obligation.
 * Every cell shows the current period's status, period and due date, and who
 * it is assigned to; the last column summarises the client. Filing itself
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
}) {
  // Columns: every tax type that appears, in policy order.
  const cols = useMemo(() => {
    const m = new Map<string, any>();
    rows.forEach(r => r.items.forEach(({ pol }) => { if (!m.has(pol.tax_type)) m.set(pol.tax_type, pol); }));
    return [...m.values()].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.label).localeCompare(String(b.label)));
  }, [rows]);

  const totals = useMemo(() => {
    const t = { obligations: 0, overdue: 0, open: 0, waiting: 0, filed: 0 };
    rows.forEach(r => r.items.forEach(({ pol, cur }) => {
      t.obligations++;
      const st = stateOf(cur, pol);
      if (st) t[st]++;
    }));
    return t;
  }, [rows]);

  const span = cols.length + 2;

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Compliance checklist</h2>
            <p className="text-xs text-muted-foreground">
              {rows.length} client{rows.length === 1 ? "" : "s"} · {totals.obligations} obligation{totals.obligations === 1 ? "" : "s"}. Click a status to open that client's filings. To file, use the Filing Record tab.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-red-800 dark:bg-red-900/40 dark:text-red-200"><AlertTriangle className="h-3 w-3" /> Overdue {totals.overdue}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/30 dark:text-amber-100"><Clock className="h-3 w-3" /> To file {totals.open}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground"><Lock className="h-3 w-3" /> Not yet open {totals.waiting}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"><Check className="h-3 w-3" /> Filed {totals.filed}</span>
          </div>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-max text-sm border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="sticky left-0 top-0 z-30 w-60 min-w-[15rem] bg-muted px-4 py-2 border-b font-medium">Client</th>
              {cols.map(pol => (
                <th key={pol.tax_type} className="sticky top-0 z-20 min-w-[11rem] bg-muted px-3 py-2 border-b font-medium align-bottom">
                  <div className="text-foreground">{pol.label}</div>
                  <div className="text-[10px] font-normal capitalize">{pol.cadence}{pol.due_day ? ` · due ${pol.due_day}` : ""}</div>
                </th>
              ))}
              <th className="sticky top-0 z-20 min-w-[9rem] bg-muted px-3 py-2 border-b font-medium">Summary</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={span} className="py-10 text-center text-muted-foreground">{emptyHint}</td></tr>}
            {rows.map(({ client, items }) => {
              const byType = new Map(items.map(it => [it.pol.tax_type, it]));
              const c = { overdue: 0, open: 0, waiting: 0, filed: 0 };
              items.forEach(({ pol, cur }) => { const st = stateOf(cur, pol); if (st) c[st]++; });
              const dot = c.overdue ? "bg-red-500" : c.open ? "bg-amber-400" : c.filed && c.filed === items.length ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600";
              return (
                <Fragment key={client.id}>
                  <tr className="group align-top">
                    <td className="sticky left-0 z-10 bg-card group-hover:bg-muted px-4 py-3 border-b">
                      <div className="flex items-start gap-2">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
                        <div>
                          <div className="font-medium leading-tight">{client.company_name}</div>
                          <div className="text-[11px] text-muted-foreground">{items.length} obligation{items.length === 1 ? "" : "s"}</div>
                        </div>
                      </div>
                    </td>
                    {cols.map(pol => {
                      const it = byType.get(pol.tax_type);
                      const cur = it?.cur ?? null;
                      const st = stateOf(cur, pol);
                      return (
                        <td key={pol.tax_type} className="px-2 py-2 border-b group-hover:bg-muted/40">
                          {!it ? (
                            <span className="block px-1 text-center text-xs text-muted-foreground/50" title="Not an obligation for this client">—</span>
                          ) : !cur ? (
                            <div className="rounded-md border border-dashed p-2">{renderMissing(client.id, pol.tax_type)}</div>
                          ) : (
                            <div className={`rounded-md border border-l-4 bg-background p-2 ${ACCENT[st!]}`}>
                              <Link to="/tax/$type" params={{ type: pol.tax_type }} search={{ client: client.id }} className="block hover:opacity-80">
                                {renderCell(cur, pol)}
                              </Link>
                              <div className="mt-1.5 border-t pt-1 text-[10px] leading-snug text-muted-foreground">
                                {cur.period_end && <div>Period ending {formatDate(cur.period_end)}</div>}
                                {st === "waiting" && <div>Opens {formatDate(filingOpenDate(cur.due_date, pol.cadence))}</div>}
                                {st !== "filed" && st !== "waiting" && cur.due_date && <div>Due {formatDate(cur.due_date)}</div>}
                                {st === "filed" && cur.filed_at && <div>Filed {formatDate(cur.filed_at)}</div>}
                              </div>
                              {isAdmin && (
                                <div className="mt-1 flex items-center gap-2 text-[10px] opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                                  {st === "filed" && <button type="button" onClick={() => onReopen(cur.id)} className="underline text-muted-foreground hover:text-foreground">Reopen</button>}
                                  <button type="button" onClick={() => onStop(client.id, pol, client.company_name)} className="text-muted-foreground hover:text-destructive">Stop</button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 border-b group-hover:bg-muted/40">
                      <div className="space-y-1 text-[11px]">
                        {c.overdue > 0 && <div className="inline-flex w-full items-center gap-1 font-medium text-red-700 dark:text-red-300"><AlertTriangle className="h-3 w-3" /> {c.overdue} overdue</div>}
                        {c.open > 0 && <div className="inline-flex w-full items-center gap-1 text-amber-700 dark:text-amber-300"><Clock className="h-3 w-3" /> {c.open} to file</div>}
                        {c.waiting > 0 && <div className="inline-flex w-full items-center gap-1 text-muted-foreground"><CircleDashed className="h-3 w-3" /> {c.waiting} not yet open</div>}
                        {c.filed > 0 && c.filed === items.length && <div className="inline-flex w-full items-center gap-1 font-medium text-emerald-700 dark:text-emerald-300"><Check className="h-3 w-3" /> All filed</div>}
                        {c.filed > 0 && c.filed < items.length && <div className="inline-flex w-full items-center gap-1 text-emerald-700 dark:text-emerald-300"><Check className="h-3 w-3" /> {c.filed} filed</div>}
                      </div>
                    </td>
                  </tr>
                  {renderAssignPanel && items.map(({ pol, cur }) => cur && assignOpenId === cur.id ? (
                    <tr key={`assign-${cur.id}`} className="bg-muted/20">
                      <td colSpan={span} className="px-4 py-2 border-b">{renderAssignPanel(cur, pol, client.company_name)}</td>
                    </tr>
                  ) : null)}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
