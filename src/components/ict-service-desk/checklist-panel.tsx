import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, ListChecks } from "lucide-react";
import { StepRow } from "./step-row";
import { Ticket, ServiceTemplate, Control, PersonLookup, progressOf } from "./types";

export function ChecklistPanel({ ticket, controls, templates, canWork, isFull, userId, ictStaff, nameOf, onChanged }: {
  ticket: Ticket; controls: Control[]; templates: ServiceTemplate[]; canWork: boolean; isFull: boolean;
  userId: string | undefined; ictStaff: { id: string; full_name: string | null }[]; nameOf: PersonLookup; onChanged: () => void;
}) {
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const sorted = useMemo(
    () => [...controls].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)),
    [controls],
  );
  const pr = progressOf(sorted);
  const ticketClosed = ticket.status === "Closed";
  const canEdit = canWork && (!ticketClosed || isFull);
  const type = ticket.service_type ?? "general";
  const typeTitle = templates.find((t) => t.service_type === type)?.title ?? type;
  const tbl = () => supabase.from("ict_case_controls" as any) as any;

  async function changeType(next: string) {
    const { error } = await supabase.from("ict_tickets").update({ service_type: next } as any).eq("id", ticket.id);
    if (error) toast.error(error.message); else { toast.success("Service type changed"); onChanged(); }
  }
  async function syncChecklist() {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("sync_ict_ticket_checklist", { _ticket_id: ticket.id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(data > 0 ? `${data} step${data === 1 ? "" : "s"} added` : "Checklist is already up to date");
    onChanged();
  }
  async function addCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!custom.trim() || !userId) return;
    setBusy(true);
    const next = (sorted[sorted.length - 1]?.sort_order ?? 0) + 10;
    const { error } = await tbl().insert({
      ticket_id: ticket.id,
      control_key: `custom_${Date.now().toString(36)}`,
      category: "custom",
      title: custom.trim(),
      mandatory: false,
      requires_evidence: false,
      requires_verification: false,
      sort_order: next,
      created_by: userId,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setCustom("");
    onChanged();
  }

  return (
    <div className="px-4 py-3 bg-muted/20 border-t space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ListChecks className="h-4 w-4 text-primary" />
          {typeTitle} checklist
          {pr.total > 0 && <span className="text-xs font-normal text-muted-foreground">{pr.complete} of {pr.total} complete</span>}
        </div>
        {canEdit && templates.length > 0 && (
          <label className="text-xs text-muted-foreground inline-flex items-center gap-1.5">Type
            <select value={type} onChange={(e) => changeType(e.target.value)} className="h-7 px-1.5 rounded border bg-background text-xs">
              {templates.map((t) => <option key={t.service_type} value={t.service_type}>{t.title}</option>)}
            </select>
          </label>
        )}
      </div>

      {pr.total > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.round((pr.complete / pr.total) * 100)}%` }} /></div>
          {pr.mandatoryOpen > 0 && ticket.status !== "Resolved" && ticket.status !== "Closed" && (
            <p className="text-xs text-muted-foreground">
              {pr.mandatoryOpen} required step{pr.mandatoryOpen === 1 ? "" : "s"} must be finished before this ticket can be resolved or closed.
            </p>
          )}
          {ticketClosed && !isFull && <p className="text-xs text-muted-foreground">This ticket is closed — the checklist is read-only.</p>}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-3">
          <span>No checklist on this ticket.</span>
          {canEdit && (
            <button type="button" disabled={busy} onClick={syncChecklist} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-50">Add {typeTitle} checklist</button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((c) => (
            <StepRow key={c.id} c={c} canEdit={canEdit} isFull={isFull} userId={userId} ictStaff={ictStaff} nameOf={nameOf} onChanged={onChanged} />
          ))}
        </ul>
      )}

      {canEdit && sorted.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={addCustom} className="flex gap-2 flex-1 min-w-[16rem]">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Add an extra step for this ticket"
              className="flex-1 h-8 px-3 rounded-md border bg-background text-xs"
            />
            <button disabled={busy || !custom.trim()} className="h-8 px-3 rounded-md border text-xs hover:border-primary/60 disabled:opacity-50 inline-flex items-center gap-1"><Plus className="h-3 w-3" />Add</button>
          </form>
          <button type="button" disabled={busy} onClick={syncChecklist} title="Add any template steps this ticket doesn't have yet" className="h-8 px-3 rounded-md border text-xs text-muted-foreground hover:border-primary/60 disabled:opacity-50">Sync with template</button>
        </div>
      )}
    </div>
  );
}

