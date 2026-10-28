import { Fragment, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { formatDate } from "@/lib/format";
import { filingOpenDate, isFilingOpen } from "@/lib/tax-period";

export type ChecklistClientRow = {
  client: { id: string; company_name: string };
  items: { pol: any; cur: any | null }[];
};

/**
 * Filing checklist, one entry per client. Each client's obligations are listed
 * together; tick the ones being filed and use the single button to file them
 * and raise ONE invoice for the client.
 */
export function TaxClientChecklist({
  rows, isAdmin, busyId, emptyHint, renderCell, renderMissing, onFileSelected, onReopen, onStop, assignOpenId, renderAssignPanel,
}: {
  rows: ChecklistClientRow[];
  isAdmin: boolean;
  busyId: string | null;
  emptyHint: string;
  renderCell: (cur: any, pol: any) => ReactNode;
  renderMissing: (clientId: string, taxType: string) => ReactNode;
  onFileSelected: (clientId: string, returnIds: string[]) => void;
  onReopen: (returnId: string) => void;
  onStop: (clientId: string, pol: any, clientName: string) => void;
  /** Return whose inline assign panel is open (expands under the client entry). */
  assignOpenId?: string | null;
  renderAssignPanel?: (cur: any, pol: any, clientName: string) => ReactNode;
}) {
  // returnIds ticked per client
  const [picked, setPicked] = useState<Record<string, string[]>>({});

  const fileable = (cur: any, pol: any) => !!cur && cur.status !== "filed" && isFilingOpen(cur.due_date, pol.cadence);
  const toggle = (clientId: string, returnId: string, on: boolean) =>
    setPicked(p => {
      const cur = new Set(p[clientId] ?? []);
      on ? cur.add(returnId) : cur.delete(returnId);
      return { ...p, [clientId]: [...cur] };
    });

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b text-xs text-muted-foreground">
        One entry per client. Tick the obligations being filed, then file them together — one invoice is generated for the client. A filed period closes and the next one waits for its month.
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground border-b">
          <tr><th className="py-2 px-3 w-56">Client</th><th className="py-2 px-3">Obligations</th><th className="py-2 px-3 w-52"></th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">{emptyHint}</td></tr>}
          {rows.map(({ client, items }) => {
            const ids = (picked[client.id] ?? []).filter(id => items.some(it => it.cur?.id === id && fileable(it.cur, it.pol)));
            const selectable = items.filter(it => fileable(it.cur, it.pol)).map(it => it.cur.id as string);
            return (
              <Fragment key={client.id}>
              <tr className="border-b last:border-0 align-top hover:bg-muted/20">
                <td className="py-2 px-3 font-medium">{client.company_name}</td>
                <td className="py-2 px-3">
                  <div className="flex flex-wrap gap-2">
                    {items.map(({ pol, cur }) => {
                      const canPick = fileable(cur, pol);
                      const filed = cur?.status === "filed";
                      return (
                        <div key={pol.tax_type} className={`rounded-md border p-2 min-w-[150px] ${canPick && ids.includes(cur.id) ? "border-primary bg-primary/5" : ""}`}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <label className={`inline-flex items-center gap-1.5 text-xs font-medium ${canPick ? "cursor-pointer" : "cursor-not-allowed opacity-80"}`}
                              title={filed ? "Filed and closed" : cur && !canPick ? `Opens for filing on ${formatDate(filingOpenDate(cur.due_date, pol.cadence))}` : "Tick to file with this client's other obligations"}>
                              <input type="checkbox" disabled={!canPick || busyId === cur?.id} checked={canPick && ids.includes(cur.id)} onChange={e => toggle(client.id, cur.id, e.target.checked)} />
                              {pol.label}
                            </label>
                            {isAdmin && (
                              <button type="button" onClick={() => onStop(client.id, pol, client.company_name)} className="text-[10px] text-muted-foreground hover:text-destructive">Stop</button>
                            )}
                          </div>
                          {!cur ? renderMissing(client.id, pol.tax_type) : (
                            <Link to="/tax/$type" params={{ type: pol.tax_type }} search={{ client: client.id }} className="inline-block hover:opacity-80">
                              {renderCell(cur, pol)}
                            </Link>
                          )}
                          {cur && !filed && !canPick && (
                            <div className="text-[10px] text-muted-foreground mt-1">Opens {formatDate(filingOpenDate(cur.due_date, pol.cadence))}</div>
                          )}
                          {filed && (
                            <div className="text-[10px] text-muted-foreground mt-1">
                              Closed{isAdmin && <> · <button type="button" onClick={() => onReopen(cur.id)} className="underline hover:text-foreground">Reopen</button></>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </td>
                <td className="py-2 px-3 text-right whitespace-nowrap">
                  {selectable.length > 0 && (
                    <div className="space-y-1">
                      <button
                        type="button"
                        disabled={ids.length === 0}
                        onClick={() => onFileSelected(client.id, ids)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Receipt className="h-3.5 w-3.5" /> File selected ({ids.length})
                      </button>
                      <div>
                        <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground underline"
                          onClick={() => setPicked(p => ({ ...p, [client.id]: ids.length === selectable.length ? [] : selectable }))}>
                          {ids.length === selectable.length ? "Clear" : "Select all open"}
                        </button>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
              {renderAssignPanel && items.map(({ pol, cur }) => cur && assignOpenId === cur.id ? (
                <tr key={`assign-${cur.id}`} className="border-b bg-muted/20">
                  <td colSpan={3} className="px-3 py-2">{renderAssignPanel(cur, pol, client.company_name)}</td>
                </tr>
              ) : null)}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
