import { Fragment } from "react";
import { ChevronRight, ChevronDown, Trash2 } from "lucide-react";
import { Ticket, ServiceTemplate, Control, PersonLookup, STATUSES, PRIORITY_COLORS, STATUS_COLORS, progressOf } from "./types";
import { StaffRow } from "./use-ict-desk";
import { ChecklistPanel } from "./checklist-panel";

export function TicketsTable({
  tickets, visibleTickets, loading, templates, controlsByTicket, staff, allStaff, nameOf, typeTitle,
  canManageTickets, fullAccess, userId, expanded, onToggleExpanded, typeFilter, onTypeFilter,
  onUpdateTicket, onDeleteTicket, onChanged,
}: {
  tickets: Ticket[];
  visibleTickets: Ticket[];
  loading: boolean;
  templates: ServiceTemplate[];
  controlsByTicket: Map<string, Control[]>;
  staff: StaffRow[];
  allStaff: StaffRow[];
  nameOf: PersonLookup;
  typeTitle: (key: string | null | undefined) => string;
  canManageTickets: boolean;
  fullAccess: boolean;
  userId: string | undefined;
  expanded: Set<string>;
  onToggleExpanded: (id: string) => void;
  typeFilter: string;
  onTypeFilter: (v: string) => void;
  onUpdateTicket: (id: string, patch: { status?: string; assigned_to?: string | null }) => void;
  onDeleteTicket: (id: string) => void;
  onChanged: () => void;
}) {
  return (
      <div id="ict-ticket-list" className="bg-card border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">{canManageTickets ? "All tickets" : "Your tickets"}</span>
          {templates.length > 0 && (
            <select value={typeFilter} onChange={(e) => onTypeFilter(e.target.value)} className="h-8 px-2 rounded-md border bg-background text-xs">
              <option value="">All request types</option>
              {templates.map((t) => <option key={t.service_type} value={t.service_type}>{t.title}</option>)}
            </select>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground border-b">
              <tr>
                {templates.length > 0 && <th className="w-8"></th>}
                <th className="py-2 px-3">Ticket</th>
                {templates.length > 0 && <th>Type</th>}
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assignee</th>
                <th>Raised</th>
                {fullAccess && <th></th>}
              </tr>
            </thead>
            <tbody>
              {!loading && tickets.length === 0 && (
                <tr><td colSpan={(fullAccess ? 7 : 6) + (templates.length > 0 ? 2 : 0)} className="py-10 text-center text-muted-foreground">{tickets.length === 0 ? "No tickets yet." : "No tickets of this type."}</td></tr>
              )}
              {visibleTickets.map((t) => {
                const cs = controlsByTicket.get(t.id) ?? [];
                const pr = progressOf(cs);
                const isOpen = expanded.has(t.id);
                const colCount = (fullAccess ? 7 : 6) + 2;
                return (
                <Fragment key={t.id}>
                <tr className="border-b last:border-0 hover:bg-muted/30">
                  {templates.length > 0 && (
                    <td className="pl-2">
                      <button onClick={() => onToggleExpanded(t.id)} title={isOpen ? "Hide checklist" : "Show checklist"} className="p-1 text-muted-foreground hover:text-primary">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                  )}
                  <td className="py-2 px-3">
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">{t.ticket_number}</div>
                  </td>
                  {templates.length > 0 && (
                    <td className="text-xs">
                      <div>{typeTitle(t.service_type)}</div>
                      {pr.total > 0 && (
                        <button onClick={() => onToggleExpanded(t.id)} className="mt-0.5 inline-flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground hover:text-primary">
                          <span className="font-medium">{pr.complete}/{pr.total} steps</span>
                          {pr.blocked > 0 && <span className="px-1 rounded bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">{pr.blocked} blocked</span>}
                          {pr.awaiting > 0 && <span className="px-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">{pr.awaiting} to verify</span>}
                          {pr.overdue > 0 && <span className="px-1 rounded bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">{pr.overdue} overdue</span>}
                        </button>
                      )}
                    </td>
                  )}
                  <td className="text-xs text-muted-foreground">{t.category ?? "—"}</td>
                  <td><span className={`text-xs px-2 py-0.5 rounded ${PRIORITY_COLORS[t.priority ?? ""] ?? "bg-muted text-muted-foreground"}`}>{t.priority ?? "—"}</span></td>
                  <td>
                    {canManageTickets ? (
                      <select
                        value={t.status}
                        onChange={(e) => onUpdateTicket(t.id, { status: e.target.value })}
                        className={`h-7 px-2 rounded text-xs border bg-background ${STATUS_COLORS[t.status] ?? ""}`}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[t.status] ?? "bg-muted text-muted-foreground"}`}>{t.status}</span>
                    )}
                  </td>
                  <td>
                    {canManageTickets ? (
                      <select
                        value={t.assigned_to ?? ""}
                        onChange={(e) => onUpdateTicket(t.id, { assigned_to: e.target.value || null })}
                        className="h-7 px-2 rounded text-xs border bg-background"
                      >
                        <option value="">Unassigned</option>
                        {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name ?? "Unnamed"}</option>)}
                      </select>
                    ) : (
                      <span className="text-xs">{allStaff.find((p) => p.id === t.assigned_to)?.full_name ?? "Unassigned"}</span>
                    )}
                  </td>
                  <td className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  {fullAccess && (
                    <td className="pr-2 text-right">
                      <button onClick={() => onDeleteTicket(t.id)} title="Delete" className="p-1 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  )}
                </tr>
                {templates.length > 0 && isOpen && (
                  <tr className="border-b last:border-0">
                    <td colSpan={colCount} className="p-0">
                      <ChecklistPanel
                        ticket={t}
                        controls={cs}
                        templates={templates}
                        canWork={canManageTickets}
                        isFull={fullAccess}
                        userId={userId}
                        ictStaff={staff}
                        nameOf={nameOf}
                        onChanged={onChanged}
                      />
                    </td>
                  </tr>
                )}
                </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
  );
}
