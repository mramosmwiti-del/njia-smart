import { AlertTriangle, Clock, UserX, LayoutGrid } from "lucide-react";
import { formatDate } from "@/lib/format";
import { TaxClientChecklist } from "@/components/tax-client-checklist";
import { TaxAssigneeSelect } from "@/components/tax-assignee-select";
import { ChecklistChip, ChecklistCell } from "./checklist-cells";
import { ALL_TYPES } from "./tax-utils";
import type { TaxCtx } from "./use-tax-page";

export function ChecklistTab({ ctx }: { ctx: TaxCtx }) {
  const { isAdmin, staff, busyCell, assignOpenId, setAssignOpenId, setBatchFor, clientFilter, setClientFilter, accFilter, setAccFilter, checklistType, setChecklistType, load, activePolicies, renderMissing, staffMap, accStats, obligatedClientCount, markFiled, checklistRows, stopObligation } = ctx;
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
            </div>
          </div>

          {activePolicies.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No active tax policies yet. Ask an admin to configure one under Settings.</p>
          ) : (
            <TaxClientChecklist
              rows={checklistRows}
              isAdmin={isAdmin}
              busyId={busyCell}
              emptyHint={`No obligated clients${clientFilter || accFilter !== "all" || checklistType !== ALL_TYPES ? " match your filters" : " yet — add tax obligations from a client's Tax tab"}.`}
              renderCell={(cur, pol) => (
                <ChecklistCell row={cur} cadence={pol.cadence} assigneeName={cur.assigned_to ? staffMap.get(cur.assigned_to) : null} />
              )}
              renderMissing={renderMissing}
              onFileSelected={(clientId, returnIds) => setBatchFor({ clientId, returnIds })}
              onReopen={id => markFiled(id, false)}
              onStop={stopObligation}
              assignOpenId={assignOpenId}
              onToggleAssign={id => setAssignOpenId(prev => prev === id ? null : id)}
              renderAssignPanel={(cur, pol, clientName) => (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Assign {pol.label} — {clientName} to:</span>
                  <TaxAssigneeSelect
                    returnId={cur.id}
                    value={cur.assigned_to}
                    staff={staff}
                    assignedAt={cur.assigned_at}
                    label={`${pol.label} — due ${formatDate(cur.due_date)}`}
                    onChanged={() => load(true)}
                  />
                  <button type="button" onClick={() => setAssignOpenId(null)} className="text-[11px] text-muted-foreground underline hover:text-foreground">Done</button>
                </div>
              )}
            />
          )}
        </div>
    </>
  );
}
