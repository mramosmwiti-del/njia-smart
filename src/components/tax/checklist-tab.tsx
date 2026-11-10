import { AlertTriangle, Check, Clock, UserX, LayoutGrid, Ban } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatDate } from "@/lib/format";
import { TaxClientChecklist } from "@/components/tax-client-checklist";
import { TaxAssignDialog } from "@/components/tax-assign-dialog";
import { ChecklistChip, ChecklistCell } from "./checklist-cells";
import { ALL_TYPES } from "./tax-utils";
import type { TaxCtx } from "./use-tax-page";

export function ChecklistTab({ ctx }: { ctx: TaxCtx }) {
  const { showFiledInChecklist, setShowFiledInChecklist, filedBlockedCount, isAdmin, staff, collabByReturn, busyCell, assignOpenId, setAssignOpenId, setBatchFor, clientFilter, setClientFilter, accFilter, setAccFilter, checklistType, setChecklistType, load, activePolicies, renderMissing, staffMap, accStats, obligatedClientCount, noObligationAll, noObligationClients, markFiled, checklistRows, stopObligation } = ctx;
  return (
    <>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div>
              <label className="text-xs font-medium text-muted-foreground mr-2">Tax type</label>
              <select value={checklistType} onChange={e => setChecklistType(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm min-w-[180px]">
                <option value={ALL_TYPES}>All types</option>
                {activePolicies.map(p => <option key={p.tax_type} value={p.tax_type}>{p.label}</option>)}
              </select>
            </div>
            <input placeholder="Filter clients…" value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="h-9 w-64 px-3 rounded-md border bg-background text-sm" />
            <div className="flex flex-wrap gap-2 ml-auto">
              <ChecklistChip active={accFilter === "all"} onClick={() => setAccFilter("all")} icon={LayoutGrid} label="All obligated" value={obligatedClientCount} tone="muted" />
              <ChecklistChip active={accFilter === "overdue"} onClick={() => setAccFilter("overdue")} icon={AlertTriangle} label="Overdue" value={accStats.flagged.overdue.size} tone="destructive" />
              <ChecklistChip active={accFilter === "duesoon"} onClick={() => setAccFilter("duesoon")} icon={Clock} label="Due ≤7 days" value={accStats.flagged.duesoon.size} tone="amber" />
              <ChecklistChip active={accFilter === "unassigned"} onClick={() => setAccFilter("unassigned")} icon={UserX} label="Unassigned" value={accStats.flagged.unassigned.size} tone="amber" />
              <ChecklistChip active={accFilter === "none"} onClick={() => setAccFilter("none")} icon={Ban} label="No obligations" value={noObligationAll.length} tone="amber" />
            </div>
          </div>

          {(filedBlockedCount > 0 || showFiledInChecklist) && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              <span>
                {showFiledInChecklist
                  ? "Showing filed obligations too (read-only)."
                  : `${filedBlockedCount} filed obligation${filedBlockedCount === 1 ? "" : "s"} blocked and hidden until the next filing period opens.`}
              </span>
              <button type="button" onClick={() => setShowFiledInChecklist(v => !v)} className="underline hover:text-foreground">
                {showFiledInChecklist ? "Hide filed" : "Show filed"}
              </button>
            </div>
          )}

          {accFilter === "none" ? (
            <div className="bg-card border rounded-lg overflow-hidden">
              <p className="px-4 py-3 border-b text-xs text-muted-foreground">
                {noObligationClients.length} client{noObligationClients.length === 1 ? "" : "s"} with no tax obligations. Open a client's Tax tab to add one.
              </p>
              {noObligationClients.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Every client has at least one obligation.</div>
              ) : (
                <div className="divide-y">
                  {noObligationClients.map((c: any) => (
                    <Link key={c.id} to="/clients/$id" params={{ id: c.id }} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/30">
                      <span className="font-medium">{c.company_name}</span>
                      <span className="text-xs text-primary">Add obligations →</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : activePolicies.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No active tax policies yet. Ask an admin to configure one under Settings.</p>
          ) : (
            <TaxClientChecklist
              rows={checklistRows}
              isAdmin={isAdmin}
              busyId={busyCell}
              emptyHint={`No obligated clients${clientFilter || accFilter !== "all" || checklistType !== ALL_TYPES ? " match your filters" : " yet — add tax obligations from a client's Tax tab"}.`}
              renderCell={(cur, pol) => (
                <ChecklistCell
                  row={cur}
                  cadence={pol.cadence}
                  assigneeName={cur.assigned_to ? staffMap.get(cur.assigned_to) : null}
                  extraNames={(collabByReturn.get(cur.id) ?? []).filter((id: string) => id !== cur.assigned_to).map((id: string) => staffMap.get(id) ?? "Unknown")}
                />
              )}
              renderMissing={renderMissing}
              onFileSelected={(clientId, returnIds) => setBatchFor({ clientId, returnIds })}
              onReopen={id => markFiled(id, false)}
              onStop={stopObligation}
              assignOpenId={assignOpenId}
              onToggleAssign={id => setAssignOpenId(prev => prev === id ? null : id)}
              renderAssignPanel={(cur, pol, clientName) => (
                <TaxAssignDialog
                  open
                  onOpenChange={o => { if (!o) setAssignOpenId(null); }}
                  returnId={cur.id}
                  title={`${pol.label} — ${clientName} · due ${formatDate(cur.due_date)}`}
                  staff={staff}
                  primaryId={cur.assigned_to}
                  collaboratorIds={collabByReturn.get(cur.id) ?? []}
                  label={`${pol.label} — ${clientName} — due ${formatDate(cur.due_date)}`}
                  onChanged={() => load(true)}
                />
              )}
            />
          )}
        </div>
    </>
  );
}
