import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type Staff = { id: string; full_name: string | null };
type Procedure = {
  id: string;
  procedure_id: string;
  status: string;
  assigned_to: string | null;
  assigned_reviewer_id: string | null;
  definition?: { title?: string; required?: boolean } | null;
};
type Signoff = {
  id: string;
  engagement_procedure_id: string;
  reviewer_id: string;
  decision: "approved" | "changes_requested" | "rejected";
  comments: string | null;
  signed_at: string;
};

const btn = "inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50";

export function AuditReviewControls({ engagementId, staff }: { engagementId: string; staff: Staff[] }) {
  const { user } = useAuth();
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [signoffs, setSignoffs] = useState<Signoff[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const db = supabase as any;
    const p = await db.from("audit_engagement_procedures")
      .select("id, procedure_id, status, assigned_to, assigned_reviewer_id, pack_id, pack_version")
      .eq("engagement_id", engagementId).order("created_at");
    if (p.error) {
      setLoadError(p.error.message || "Audit procedure tables could not be loaded.");
      toast.error(`Could not load procedures: ${p.error.message}`);
      setProcedures([]); setSignoffs([]); setLoading(false); return;
    }
    setLoadError(null);
    const rows = (p.data ?? []) as Array<Procedure & { pack_id: string; pack_version: number }>;
    const definitionResults = await Promise.all(rows.map(async (row) => {
      const result = await db.from("audit_procedure_definitions")
        .select("title, required").eq("pack_id", row.pack_id).eq("pack_version", row.pack_version)
        .eq("procedure_id", row.procedure_id).maybeSingle();
      return { id: row.id, definition: result.data ?? null };
    }));
    const definitions = new Map(definitionResults.map((item) => [item.id, item.definition]));
    setProcedures(rows.map((row) => ({ ...row, definition: definitions.get(row.id) ?? null })) as Procedure[]);
    if (rows.length === 0) {
      setSignoffs([]); setLoading(false); return;
    }
    const s = await db.from("audit_signoffs")
      .select("id, engagement_procedure_id, reviewer_id, decision, comments, signed_at")
      .in("engagement_procedure_id", rows.map((row) => row.id)).order("signed_at", { ascending: false });
    if (s.error) toast.error(`Could not load sign-offs: ${s.error.message}`);
    else setSignoffs((s.data ?? []) as Signoff[]);
    setLoading(false);
  }, [engagementId]);

  useEffect(() => { void load(); }, [load]);

  async function assignReviewer(procedureId: string, reviewerId: string) {
    setSavingId(procedureId);
    const { error } = await (supabase as any).from("audit_engagement_procedures")
      .update({ assigned_reviewer_id: reviewerId || null, updated_at: new Date().toISOString() })
      .eq("id", procedureId).eq("engagement_id", engagementId);
    setSavingId(null);
    if (error) toast.error(error.message);
    else { toast.success("Reviewer assignment saved"); await load(); }
  }

  async function submitDecision(procedure: Procedure, decision: Signoff["decision"]) {
    if (!user?.id) { toast.error("Sign in before recording a review decision"); return; }
    const text = (comments[procedure.id] ?? "").trim();
    if (decision !== "approved" && !text) {
      toast.error("Add a review comment when requesting changes or rejecting work"); return;
    }
    setSavingId(procedure.id);
    const { error } = await (supabase as any).rpc("audit_record_procedure_signoff", {
      p_engagement_procedure_id: procedure.id,
      p_decision: decision,
      p_comments: text || null,
    });
    setSavingId(null);
    if (error) toast.error(error.message);
    else { toast.success(decision === "approved" ? "Procedure approved" : decision === "changes_requested" ? "Changes requested" : "Procedure rejected"); setComments((old) => ({ ...old, [procedure.id]: "" })); await load(); }
  }

  const latestSignoff = (procedureId: string) => signoffs.find((item) => item.engagement_procedure_id === procedureId);

  return <section className="space-y-3 rounded-lg border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><h2 className="font-semibold">Independent review and sign-off</h2><span className="rounded bg-muted px-2 py-0.5 text-xs">{procedures.length}</span></div>
      <button className={btn} onClick={() => void load()} disabled={loading}><RefreshCw className="h-3.5 w-3.5" />Refresh</button>
    </div>
    <p className="text-sm text-muted-foreground">Assign a reviewer who is different from the preparer. Review decisions are recorded through a database function; direct status changes cannot substitute for a sign-off.</p>
    {loadError && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1"><p className="font-medium text-sm">Review controls cannot connect to the audit database.</p><p className="text-sm">Confirm the Phase 1–3 migrations have been applied to this Supabase project, then refresh.</p><p className="text-xs text-muted-foreground">Database message: {loadError}</p></div>}
    {procedures.length === 0 && !loading && !loadError && <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Initialize the engagement procedure checklist before assigning reviewers.</div>}
    <div className="space-y-3">
      {procedures.map((procedure) => {
        const signoff = latestSignoff(procedure.id);
        const reviewerName = staff.find((person) => person.id === procedure.assigned_reviewer_id)?.full_name ?? "Unassigned";
        const currentUserIsReviewer = !!user?.id && procedure.assigned_reviewer_id === user.id;
        const canReview = currentUserIsReviewer && ["prepared", "under_review", "review_notes"].includes(procedure.status);
        return <div key={procedure.id} className="space-y-2 rounded-md border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1"><div className="font-medium text-sm">{procedure.definition?.title ?? procedure.procedure_id}</div><div className="mt-1 text-xs text-muted-foreground">Status: {procedure.status.replaceAll("_", " ")} · Reviewer: {reviewerName}</div></div>
            {signoff && <span className={`rounded px-2 py-1 text-xs ${signoff.decision === "approved" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>{signoff.decision.replaceAll("_", " ")}</span>}
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <select aria-label={`Reviewer for ${procedure.procedure_id}`} className="min-w-0 rounded-md border bg-background px-3 py-2 text-sm" value={procedure.assigned_reviewer_id ?? ""} disabled={savingId === procedure.id} onChange={(event) => void assignReviewer(procedure.id, event.target.value)}>
              <option value="">Assign reviewer…</option>
              {staff.filter((person) => person.id !== procedure.assigned_to).map((person) => <option key={person.id} value={person.id}>{person.full_name ?? person.id}</option>)}
            </select>
            <span className="self-center text-xs text-muted-foreground">Preparer and reviewer must differ</span>
          </div>
          {signoff?.comments && <div className="rounded bg-muted/50 p-2 text-sm"><span className="font-medium">Latest review comment: </span>{signoff.comments}</div>}
          {canReview && <div className="space-y-2 border-t pt-3">
            <label className="block text-xs font-medium">Review comments<textarea className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" rows={2} value={comments[procedure.id] ?? ""} onChange={(event) => setComments((old) => ({ ...old, [procedure.id]: event.target.value }))} placeholder="Required when requesting changes or rejecting work" /></label>
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={savingId === procedure.id} onClick={() => void submitDecision(procedure, "approved")}><CheckCircle2 className="h-4 w-4" />Approve</button>
              <button className={btn} disabled={savingId === procedure.id} onClick={() => void submitDecision(procedure, "changes_requested")}><Send className="h-4 w-4" />Request changes</button>
              <button className={btn} disabled={savingId === procedure.id} onClick={() => void submitDecision(procedure, "rejected")}><ClipboardCheck className="h-4 w-4" />Reject</button>
            </div>
          </div>}
        </div>;
      })}
    </div>
  </section>;
}
