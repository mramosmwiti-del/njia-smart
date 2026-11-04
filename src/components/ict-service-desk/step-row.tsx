import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { StepStatus, Control, PersonLookup, STEP_LABEL, STEP_COLORS, isStepComplete, fmtDate } from "./types";

export function StepRow({ c, canEdit, isFull, userId, ictStaff, nameOf, onChanged }: {
  c: Control; canEdit: boolean; isFull: boolean; userId: string | undefined;
  ictStaff: { id: string; full_name: string | null }[]; nameOf: PersonLookup; onChanged: () => void;
}) {
  const [note, setNote] = useState(c.evidence_note ?? "");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!dirty) setNote(c.evidence_note ?? ""); }, [c.evidence_note, dirty]);

  // A verified step is locked for everyone except full-module roles (server-enforced too).
  const locked = !canEdit || (c.status === "verified" && !isFull);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = !!c.due_date && c.due_date < today && !isStepComplete(c);
  const tbl = () => supabase.from("ict_case_controls" as any) as any;

  async function run(patch: Record<string, unknown>, withNote: boolean, okMsg?: string) {
    setBusy(true);
    const { error } = await tbl().update(withNote ? { evidence_note: note.trim() || null, ...patch } : patch).eq("id", c.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (withNote) setDirty(false);
    if (okMsg) toast.success(okMsg);
    onChanged();
  }
  async function remove() {
    if (!confirm("Remove this step?")) return;
    const { error } = await tbl().delete().eq("id", c.id);
    if (error) toast.error(error.message); else onChanged();
  }

  const selfCompleted = c.status === "done" && c.requires_verification && c.completed_by === userId;
  const canVerify = !locked && c.status === "done" && c.requires_verification && !selfCompleted;

  return (
    <li className="border rounded-md p-3 bg-background space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">{c.title}</span>
            {c.mandatory && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wide">Required</span>}
            {c.requires_verification && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" />2nd-person check</span>}
            {overdue && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">Overdue</span>}
          </div>
          {c.guidance && <p className="text-xs text-muted-foreground mt-0.5">{c.guidance}</p>}
        </div>
        {locked ? (
          <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${STEP_COLORS[c.status]}`}>{STEP_LABEL[c.status]}</span>
        ) : (
          <select
            value={c.status === "verified" ? "done" : c.status}
            disabled={busy || c.status === "verified"}
            onChange={(e) => run({ status: e.target.value }, true)}
            className={`h-7 px-2 rounded text-xs border bg-background shrink-0 ${STEP_COLORS[c.status]}`}
          >
            {(["not_started", "in_progress", "blocked", "done", "not_applicable"] as StepStatus[]).map((st) => (
              <option key={st} value={st}>{STEP_LABEL[st]}</option>
            ))}
          </select>
        )}
      </div>

      {(c.requires_evidence || c.status !== "not_started" || note || !locked) && (
        locked ? (
          c.evidence_note ? <p className="text-xs whitespace-pre-wrap rounded bg-muted/40 px-2 py-1.5">{c.evidence_note}</p> : null
        ) : (
          <div className="space-y-1">
            <textarea
              rows={2}
              value={note}
              disabled={busy}
              onChange={(e) => { setNote(e.target.value); setDirty(true); }}
              placeholder={(c.requires_evidence ? "Evidence required — " : "Notes — ") + (c.evidence_hint ?? "what was done, reference, who confirmed")}
              className="w-full px-2 py-1.5 rounded-md border bg-background text-xs"
            />
            {dirty && (
              <button type="button" disabled={busy} onClick={() => run({}, true, "Note saved")} className="h-7 px-2 rounded-md border text-xs hover:border-primary/60 disabled:opacity-50">Save note</button>
            )}
          </div>
        )
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {locked ? (
          <>
            {c.assigned_to && <span>Owner: {nameOf(c.assigned_to)}</span>}
            {c.due_date && <span className={overdue ? "text-destructive" : ""}>Due {fmtDate(c.due_date)}</span>}
          </>
        ) : (
          <>
            <label className="inline-flex items-center gap-1.5">Owner
              <select
                value={c.assigned_to ?? ""}
                disabled={busy}
                onChange={(e) => run({ assigned_to: e.target.value || null }, false)}
                className="h-7 px-1.5 rounded border bg-background text-xs"
              >
                <option value="">Unassigned</option>
                {ictStaff.map((p) => <option key={p.id} value={p.id}>{p.full_name ?? "Unnamed"}</option>)}
              </select>
            </label>
            <label className="inline-flex items-center gap-1.5">Due
              <input
                type="date"
                value={c.due_date ?? ""}
                disabled={busy}
                onChange={(e) => run({ due_date: e.target.value || null }, false)}
                className="h-7 px-1.5 rounded border bg-background text-xs"
              />
            </label>
          </>
        )}
        {c.completed_at && (c.status === "done" || c.status === "verified") && (
          <span>Done by {nameOf(c.completed_by)} · {fmtDate(c.completed_at)}</span>
        )}
        {c.status === "not_applicable" && c.completed_at && <span>Marked by {nameOf(c.completed_by)} · {fmtDate(c.completed_at)}</span>}
        {c.status === "verified" && c.verified_at && (
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3 w-3" />Verified by {nameOf(c.verified_by)} · {fmtDate(c.verified_at)}</span>
        )}
        {selfCompleted && <span className="text-amber-700 dark:text-amber-300">Waiting for someone else to verify</span>}
        <span className="ml-auto inline-flex items-center gap-2">
          {canVerify && (
            <button type="button" disabled={busy} onClick={() => run({ status: "verified" }, true, "Step verified")} className="h-7 px-2 rounded-md bg-emerald-600 text-white text-xs inline-flex items-center gap-1 disabled:opacity-50">
              <ShieldCheck className="h-3 w-3" />Verify
            </button>
          )}
          {isFull && c.status === "verified" && (
            <button type="button" disabled={busy} onClick={() => run({ status: "in_progress" }, false, "Step reopened")} className="h-7 px-2 rounded-md border text-xs hover:border-primary/60 disabled:opacity-50">Reopen</button>
          )}
          {!locked && c.template_control_id === null && c.status === "not_started" && (
            <button type="button" onClick={remove} title="Remove step" className="p-1 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
          )}
        </span>
      </div>
    </li>
  );
}

