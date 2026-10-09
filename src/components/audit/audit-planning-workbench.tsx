import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ClipboardCheck, Plus, RefreshCw, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type Risk = {
  id: string;
  title: string;
  description: string;
  financial_statement_area: string | null;
  assertions: string[];
  likelihood: "low" | "moderate" | "high" | null;
  impact: "low" | "moderate" | "high" | null;
  significant_risk: boolean;
  planned_response: string | null;
  status: "identified" | "assessed" | "responded" | "closed";
};
type Procedure = {
  id: string;
  procedure_id: string;
  pack_id: string;
  pack_version: number;
  status: string;
  assigned_to: string | null;
  definition?: { title?: string; section_id?: string; required?: boolean; standard_references?: string[]; definition?: { objective?: string; expectedEvidence?: string[] } };
  latestResult?: { work_performed?: string; conclusion?: string; exceptions?: unknown[] };
};

const PACK_ID = "ke-private-financial-audit";
const PACK_VERSION = 1;
const ASSERTIONS = ["existence", "completeness", "accuracy", "valuation", "rights_and_obligations", "cutoff", "classification", "presentation"];
const STATUS_OPTIONS = ["not_started", "in_progress", "prepared", "under_review", "review_notes", "completed", "not_applicable"];
const inputClass = "mt-1 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50";

export function AuditPlanningWorkbench({ engagementId, workpapers }: { engagementId: string; workpapers: Array<{ id: string; title: string }> }) {
  const { user } = useAuth();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [riskTitle, setRiskTitle] = useState("");
  const [riskArea, setRiskArea] = useState("");
  const [riskDescription, setRiskDescription] = useState("");
  const [riskLikelihood, setRiskLikelihood] = useState<Risk["likelihood"]>("moderate");
  const [riskImpact, setRiskImpact] = useState<Risk["impact"]>("moderate");
  const [riskAssertions, setRiskAssertions] = useState<string[]>([]);
  const [riskResponse, setRiskResponse] = useState("");
  const [riskSignificant, setRiskSignificant] = useState(false);
  const [activeProcedureId, setActiveProcedureId] = useState("");
  const [resultStatus, setResultStatus] = useState("in_progress");
  const [workPerformed, setWorkPerformed] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [exceptionText, setExceptionText] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  const [linkedRiskId, setLinkedRiskId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const db = supabase as any;
    const [riskRes, procRes, defRes] = await Promise.all([
      db.from("audit_risks").select("*").eq("engagement_id", engagementId).order("created_at", { ascending: false }),
      db.from("audit_engagement_procedures").select("*").eq("engagement_id", engagementId).order("created_at"),
      db.from("audit_procedure_definitions").select("*").eq("pack_id", PACK_ID).eq("pack_version", PACK_VERSION).eq("enabled", true),
    ]);
    const firstError = riskRes.error || procRes.error || defRes.error;
    if (firstError) {
      const message = firstError.message || "The audit planning tables could not be loaded.";
      setLoadError(message);
      toast.error(`Could not load audit planning data: ${message}`);
      setLoading(false);
      return;
    }
    const procedureIds = (procRes.data ?? []).map((procedure: any) => procedure.id);
    const resultRes = procedureIds.length
      ? await db.from("audit_procedure_results").select("*").in("engagement_procedure_id", procedureIds).order("prepared_at", { ascending: false })
      : { data: [], error: null };
    if (resultRes.error) {
      setLoadError(resultRes.error.message || "Procedure results could not be loaded.");
      toast.error(`Could not load procedure results: ${resultRes.error.message}`);
      setLoading(false);
      return;
    }
    const definitions = new Map<string, Procedure["definition"]>((defRes.data ?? []).map((d: any) => [d.procedure_id, {
      title: d.title,
      section_id: d.section_id,
      required: d.required,
      standard_references: d.standard_references ?? [],
      definition: d.definition ?? {},
    }]));
    const latestResults = new Map<string, Procedure["latestResult"]>();
    for (const result of resultRes.data ?? []) {
      if (!latestResults.has(result.engagement_procedure_id)) latestResults.set(result.engagement_procedure_id, result);
    }
    setRisks((riskRes.data ?? []) as Risk[]);
    setProcedures((procRes.data ?? []).map((p: any) => ({ ...p, definition: definitions.get(p.procedure_id), latestResult: latestResults.get(p.id) })));
    setLoadError(null);
    setLoading(false);
  }, [engagementId]);

  useEffect(() => { void load(); }, [load]);

  async function initializeProcedures() {
    setSaving(true);
    const db = supabase as any;
    const { data: defs, error: defError } = await db.from("audit_procedure_definitions")
      .select("procedure_id").eq("pack_id", PACK_ID).eq("pack_version", PACK_VERSION).eq("enabled", true);
    if (defError) { toast.error(defError.message); setSaving(false); return; }
    if (!defs?.length) { toast.error("No active procedure definitions were found. Apply the audit foundation migration first."); setSaving(false); return; }
    const rows = defs.map((d: { procedure_id: string }) => ({
      engagement_id: engagementId, pack_id: PACK_ID, pack_version: PACK_VERSION,
      procedure_id: d.procedure_id, created_by: user?.id ?? null,
    }));
    const { error } = await db.from("audit_engagement_procedures").upsert(rows, {
      onConflict: "engagement_id,pack_id,pack_version,procedure_id", ignoreDuplicates: true,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Procedure checklist initialized"); await load(); }
  }

  async function addRisk() {
    if (!riskTitle.trim()) { toast.error("Enter a risk title"); return; }
    setSaving(true);
    const { error } = await (supabase as any).from("audit_risks").insert({
      engagement_id: engagementId,
      title: riskTitle.trim(), description: riskDescription.trim(),
      financial_statement_area: riskArea.trim() || null,
      assertions: riskAssertions, likelihood: riskLikelihood, impact: riskImpact,
      significant_risk: riskSignificant, planned_response: riskResponse.trim() || null,
      status: "assessed", created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Risk recorded"); setRiskTitle(""); setRiskDescription(""); setRiskArea("");
      setRiskAssertions([]); setRiskResponse(""); setRiskSignificant(false); await load();
    }
  }

  function openProcedure(procedure: Procedure) {
    setActiveProcedureId(procedure.id);
    setResultStatus(procedure.status === "not_started" ? "in_progress" : procedure.status);
    setWorkPerformed(procedure.latestResult?.work_performed ?? "");
    setConclusion(procedure.latestResult?.conclusion ?? "");
    const exceptions = procedure.latestResult?.exceptions ?? [];
    setExceptionText(Array.isArray(exceptions) ? exceptions.map((item: any) => typeof item === "string" ? item : JSON.stringify(item)).join("\n") : "");
    setEvidenceId("");
    setLinkedRiskId("");
  }

  async function saveProcedure() {
    const procedure = procedures.find((p) => p.id === activeProcedureId);
    if (!procedure) return;
    const selectedStatus = resultStatus;
    if (["under_review", "completed"].includes(selectedStatus)) {
      toast.error("Review and completion sign-off controls will be enabled in the quality-review phase"); return;
    }
    if (["prepared"].includes(selectedStatus) && !conclusion.trim()) {
      toast.error("Add a conclusion before marking this procedure prepared or complete"); return;
    }
    if (["prepared"].includes(selectedStatus) && !workPerformed.trim()) {
      toast.error("Document the work performed before marking this procedure prepared or complete"); return;
    }
    setSaving(true);
    const db = supabase as any;
    const exceptions = exceptionText.split("\n").map((line) => line.trim()).filter(Boolean);
    const { error: resultError } = await db.from("audit_procedure_results").insert({
      engagement_procedure_id: procedure.id,
      work_performed: workPerformed.trim(), conclusion: conclusion.trim() || null,
      exceptions, result_data: { recorded_from: "audit-planning-workbench" },
      prepared_by: user?.id ?? null,
    });
    if (resultError) { toast.error(resultError.message); setSaving(false); return; }
    const { error: statusError } = await db.from("audit_engagement_procedures").update({ status: selectedStatus, updated_at: new Date().toISOString() }).eq("id", procedure.id);
    if (statusError) { toast.error(`Result saved, but status update failed: ${statusError.message}`); setSaving(false); await load(); return; }
    if (evidenceId) {
      const { error } = await db.from("audit_evidence_links").upsert({ engagement_procedure_id: procedure.id, workpaper_id: evidenceId, note: "Linked from procedure execution" }, { onConflict: "engagement_procedure_id,workpaper_id" });
      if (error) { toast.error(`Procedure saved, but evidence link failed: ${error.message}`); setSaving(false); await load(); return; }
    }
    if (linkedRiskId) {
      const { error } = await db.from("audit_risk_procedure_links").upsert({ risk_id: linkedRiskId, engagement_procedure_id: procedure.id, linked_by: user?.id ?? null }, { onConflict: "risk_id,engagement_procedure_id" });
      if (error) { toast.error(`Procedure saved, but risk link failed: ${error.message}`); setSaving(false); await load(); return; }
    }
    setSaving(false); toast.success("Procedure result saved"); await load();
  }

  async function updateProcedureStatus(procedureId: string, status: string) {
    if (["prepared", "under_review", "completed"].includes(status)) {
      toast.error("Use Record work / conclusion for preparation. Review and completion require the quality-review phase.");
      await load();
      return;
    }
    const { error } = await (supabase as any).from("audit_engagement_procedures")
      .update({ status, updated_at: new Date().toISOString() }).eq("id", procedureId);
    if (error) toast.error(error.message); else await load();
  }

  async function updateRiskStatus(riskId: string, status: Risk["status"]) {
    const { error } = await (supabase as any).from("audit_risks").update({ status, updated_at: new Date().toISOString() }).eq("id", riskId);
    if (error) toast.error(error.message); else await load();
  }

  const activeProcedure = procedures.find((p) => p.id === activeProcedureId);

  return <div className="space-y-4">
    {loadError && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-1">
      <h3 className="font-semibold text-sm">Audit database setup is incomplete</h3>
      <p className="text-sm">The risk register and procedure checklist could not load. Apply the three audit migrations in order (foundation, risk/procedure links, then review/sign-off), then refresh this page.</p>
      <p className="text-xs text-muted-foreground">Database message: {loadError}</p>
    </div>}
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" /><h2 className="font-semibold">Audit risk register</h2><span className="rounded bg-muted px-2 py-0.5 text-xs">{risks.length}</span></div>
        <button className={buttonClass} onClick={() => void load()} disabled={loading}><RefreshCw className="h-3.5 w-3.5" />Refresh</button>
      </div>
      <p className="text-sm text-muted-foreground">Record assessed risks and their planned responses. Link each risk to the procedures designed to address it.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-medium">Risk title<input className={inputClass} value={riskTitle} onChange={(e) => setRiskTitle(e.target.value)} placeholder="e.g. Revenue recognition may be misstated" /></label>
        <label className="text-xs font-medium">Financial statement area<input className={inputClass} value={riskArea} onChange={(e) => setRiskArea(e.target.value)} placeholder="e.g. Revenue, receivables, inventory" /></label>
        <label className="text-xs font-medium md:col-span-2">Risk description<textarea className={inputClass} rows={2} value={riskDescription} onChange={(e) => setRiskDescription(e.target.value)} placeholder="Describe the risk and relevant circumstances" /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium">Likelihood<select className={inputClass} value={riskLikelihood ?? "moderate"} onChange={(e) => setRiskLikelihood(e.target.value as Risk["likelihood"])}><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option></select></label>
        <label className="text-xs font-medium">Impact<select className={inputClass} value={riskImpact ?? "moderate"} onChange={(e) => setRiskImpact(e.target.value as Risk["impact"])}><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option></select></label>
        <label className="text-xs font-medium">Planned response<input className={inputClass} value={riskResponse} onChange={(e) => setRiskResponse(e.target.value)} placeholder="e.g. Confirm, test cutoff" /></label>
        <label className="flex items-center gap-2 pt-5 text-sm"><input type="checkbox" checked={riskSignificant} onChange={(e) => setRiskSignificant(e.target.checked)} /> Significant risk</label>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {ASSERTIONS.map((assertion) => <label key={assertion} className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={riskAssertions.includes(assertion)} onChange={(e) => setRiskAssertions((old) => e.target.checked ? [...old, assertion] : old.filter((item) => item !== assertion))} />{assertion.replaceAll("_", " ")}</label>)}
      </div>
      <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50" onClick={() => void addRisk()} disabled={saving}><Plus className="h-4 w-4" />Add assessed risk</button>
      <div className="space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Loading risk register…</p>}
        {!loading && risks.length === 0 && <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">No risks recorded yet.</div>}
        {risks.map((risk) => <div key={risk.id} className="rounded-md border p-3 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-medium text-sm">{risk.title}{risk.significant_risk && <span className="ml-2 rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Significant</span>}</div><div className="mt-1 text-xs text-muted-foreground">{risk.financial_statement_area || "No area specified"} · likelihood {risk.likelihood ?? "—"} · impact {risk.impact ?? "—"}</div></div><select aria-label={`Status for ${risk.title}`} className="rounded-md border bg-background px-2 py-1 text-xs" value={risk.status} onChange={(e) => void updateRiskStatus(risk.id, e.target.value as Risk["status"])}>{["identified", "assessed", "responded", "closed"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></div>
          {risk.description && <p className="whitespace-pre-wrap text-sm">{risk.description}</p>}
          {risk.assertions?.length > 0 && <p className="text-xs text-muted-foreground">Assertions: {risk.assertions.join(", ").replaceAll("_", " ")}</p>}
          {risk.planned_response && <p className="text-sm"><span className="font-medium">Planned response:</span> {risk.planned_response}</p>}
        </div>)}
      </div>
    </section>

    <section className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" /><h2 className="font-semibold">Audit procedures</h2><span className="rounded bg-muted px-2 py-0.5 text-xs">{procedures.length}</span></div><button className={buttonClass} disabled={saving || loading} onClick={() => void initializeProcedures()}><Plus className="h-3.5 w-3.5" />Initialize checklist</button></div>
      <p className="text-sm text-muted-foreground">Initializes the selected version of the Kenya private-sector audit pack for this engagement. Existing procedure instances are retained.</p>
      {procedures.length === 0 && !loading && <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No procedures initialized. Apply the foundation migration, then initialize the checklist.</div>}
      <div className="space-y-2">{procedures.map((procedure) => <div key={procedure.id} className="rounded-md border p-3">
        <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1"><div className="font-medium text-sm">{procedure.definition?.title ?? procedure.procedure_id}{procedure.definition?.required && <span className="ml-2 text-xs text-destructive">Required</span>}</div><div className="mt-1 text-xs text-muted-foreground">{procedure.definition?.section_id?.replaceAll("_", " ") ?? "Audit procedure"} · {procedure.definition?.standard_references?.join(", ")}</div>{procedure.definition?.definition?.objective && <p className="mt-2 text-sm">{procedure.definition.definition.objective}</p>}{procedure.latestResult?.conclusion && <p className="mt-1 text-xs text-muted-foreground">Latest conclusion: {procedure.latestResult.conclusion}</p>}</div><select aria-label={`Status for ${procedure.definition?.title ?? procedure.procedure_id}`} className="rounded-md border bg-background px-2 py-1 text-xs" value={procedure.status} onChange={(e) => void updateProcedureStatus(procedure.id, e.target.value)}>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></div>
        <div className="mt-2 flex justify-end"><button className={buttonClass} onClick={() => openProcedure(procedure)}><Save className="h-3.5 w-3.5" />Record work / conclusion</button></div>
      </div>)}</div>
    </section>

    {activeProcedure && <section className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Record procedure result: {activeProcedure.definition?.title ?? activeProcedure.procedure_id}</h3><button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setActiveProcedureId("")}>Close</button></div>
      {activeProcedure.definition?.definition?.expectedEvidence?.length ? <div className="rounded-md bg-muted/50 p-3 text-sm"><div className="font-medium">Expected evidence</div><ul className="mt-1 list-disc pl-5">{activeProcedure.definition.definition.expectedEvidence.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
      <label className="block text-xs font-medium">Procedure status<select className={inputClass} value={resultStatus} onChange={(e) => setResultStatus(e.target.value)}><option value="in_progress">In progress</option><option value="prepared">Prepared</option><option value="review_notes">Review notes</option><option value="not_applicable">Not applicable</option></select></label>
      <label className="block text-xs font-medium">Work performed<textarea className={inputClass} rows={4} value={workPerformed} onChange={(e) => setWorkPerformed(e.target.value)} placeholder="Document the procedures actually performed, including timing and extent." /></label>
      <label className="block text-xs font-medium">Conclusion<textarea className={inputClass} rows={3} value={conclusion} onChange={(e) => setConclusion(e.target.value)} placeholder="Record the conclusion supported by the evidence." /></label>
      <label className="block text-xs font-medium">Exceptions / findings (one per line)<textarea className={inputClass} rows={2} value={exceptionText} onChange={(e) => setExceptionText(e.target.value)} placeholder="Describe exceptions, deviations, or findings" /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Link workpaper evidence<select className={inputClass} value={evidenceId} onChange={(e) => setEvidenceId(e.target.value)}><option value="">No workpaper selected</option>{workpapers.map((workpaper) => <option key={workpaper.id} value={workpaper.id}>{workpaper.title}</option>)}</select></label><label className="text-xs font-medium">Link assessed risk<select className={inputClass} value={linkedRiskId} onChange={(e) => setLinkedRiskId(e.target.value)}><option value="">No risk selected</option>{risks.map((risk) => <option key={risk.id} value={risk.id}>{risk.title}</option>)}</select></label></div>
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><AlertCircle className="h-3.5 w-3.5" />Saving creates a dated result record; it does not independently approve the work.</p><button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={saving} onClick={() => void saveProcedure()}><Save className="h-4 w-4" />Save result</button></div>
    </section>}
  </div>;
}
