import { X, Trash2, Pencil, Upload, FileText, Eye, Download, ChevronDown, ChevronRight, ShieldCheck, Lock, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { CompletionInvoiceDialog, LinkedInvoice } from "@/components/completion-invoice-dialog";
import { fmtDateTime } from "./constants";
import type { ServiceModuleCtx } from "./use-service-module";

export function MilestoneEditor({ ctx }: { ctx: ServiceModuleCtx }) {
  const { isAdmin, STAGES, defaultStageKey, stageLabel, staff, milestoneEditor, setMilestoneEditor, msTitle, setMsTitle, msDue, setMsDue, msNotes, setMsNotes, msAssignee, setMsAssignee, msStage, setMsStage, editingMs, setEditingMs, editMsData, setEditMsData, milestoneDocs, expandedMs, uploadingMs, closureNotes, setClosureNotes, closeInvoiceOpen, setCloseInvoiceOpen, staffName, setStage, closeProject, finishClose, reopenProject, addMilestone, toggleMilestone, verifyMilestone, removeMilestone, startEditMs, saveEditMs, toggleExpandMs, uploadMsDoc, verifyDoc, viewDoc, downloadDoc, removeMsDoc, editorMs, editorClosed, editorDone, editorVerified, moduleLabel } = ctx;
  return (
    <>
      {milestoneEditor && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setMilestoneEditor(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-card w-full max-w-3xl rounded-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold">{milestoneEditor.title}</h2>
                <p className="text-xs text-muted-foreground">{milestoneEditor.clients?.company_name} · Started {formatDate(milestoneEditor.start_date)} · Target {formatDate(milestoneEditor.due_date)}</p>
              </div>
              <button onClick={() => setMilestoneEditor(null)}><X className="h-4 w-4" /></button>
            </div>

            <div className="border rounded-md p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">Progress stage</div>
              <div className="flex flex-wrap gap-1.5">
                {STAGES.filter(s => s.key !== "closed").map((s, i) => {
                  const current = (milestoneEditor.stage ?? defaultStageKey) === s.key;
                  const passed = STAGES.findIndex(x => x.key === (milestoneEditor.stage ?? defaultStageKey)) > i;
                  return (
                    <button key={s.key} disabled={editorClosed} onClick={() => setStage(s.key)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition disabled:opacity-50 ${current ? "bg-primary text-primary-foreground border-primary" : passed ? "bg-accent/20 border-accent/40" : "bg-background hover:border-primary/50"}`}>
                      {i + 1}. {s.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{editorDone}/{editorMs.length} steps complete · {editorVerified} verified</div>
            </div>

            <div className="space-y-2 max-h-96 overflow-auto">
              <div className="text-xs font-medium text-muted-foreground">Steps, documents & verification</div>
              {editorMs.length === 0 && <p className="text-sm text-muted-foreground">No steps recorded yet.</p>}
              {editorMs.map((m: any) => {
                const assigneeName = staff.find(s => s.id === m.assigned_to)?.full_name;
                if (editingMs === m.id) {
                  return (
                    <div key={m.id} className="border rounded-md p-2 space-y-2 bg-muted/20">
                      <input value={editMsData.title} onChange={e => setEditMsData({ ...editMsData, title: e.target.value })} className="w-full h-8 px-2 rounded border bg-background text-sm" />
                      <div className="grid grid-cols-3 gap-2">
                        <input type="date" value={editMsData.due_date} onChange={e => setEditMsData({ ...editMsData, due_date: e.target.value })} className="h-8 px-2 rounded border bg-background text-sm" />
                        <select value={editMsData.assigned_to} onChange={e => setEditMsData({ ...editMsData, assigned_to: e.target.value })} className="h-8 px-2 rounded border bg-background text-sm">
                          <option value="">— Unassigned —</option>
                          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                        </select>
                        <select value={editMsData.stage} onChange={e => setEditMsData({ ...editMsData, stage: e.target.value })} className="h-8 px-2 rounded border bg-background text-sm">
                          {STAGES.filter(s => s.key !== "closed").map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      </div>
                      <textarea placeholder="Notes / action taken" value={editMsData.notes} onChange={e => setEditMsData({ ...editMsData, notes: e.target.value })} rows={2} className="w-full px-2 py-1 rounded border bg-background text-sm" />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingMs(null)} className="text-xs text-muted-foreground">Cancel</button>
                        <button onClick={saveEditMs} className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground">Save</button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={m.id} className="py-2 border-b last:border-0">
                    <div className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={m.done} disabled={editorClosed} onChange={e => toggleMilestone(m.id, e.target.checked)} />
                      <button onClick={() => toggleExpandMs(m.id)} className="text-muted-foreground hover:text-foreground" title="Documents">
                        {expandedMs[m.id] ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                      <div className={`flex-1 ${m.done ? "line-through text-muted-foreground" : ""}`}>{m.title}</div>
                      {m.stage && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted whitespace-nowrap">{stageLabel(m.stage)}</span>}
                      {(milestoneDocs[m.id]?.length ?? 0) > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted inline-flex items-center gap-1"><FileText className="h-3 w-3" />{milestoneDocs[m.id].length}</span>
                      )}
                      <span className="text-xs text-muted-foreground">{formatDate(m.due_date)}</span>
                      <button onClick={() => verifyMilestone(m)} disabled={editorClosed} title={m.verified ? "Remove verification" : "Verify this step"}
                        className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border disabled:opacity-50 ${m.verified ? "bg-accent/20 border-accent/40 text-foreground" : "text-muted-foreground"}`}>
                        <ShieldCheck className="h-3 w-3" />{m.verified ? "Verified" : "Verify"}
                      </button>
                      <button onClick={() => startEditMs(m)} className="text-muted-foreground hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => removeMilestone(m.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    {(assigneeName || m.notes || m.completed_at || m.verified) && (
                      <div className="ml-6 mt-1 text-xs text-muted-foreground space-y-0.5">
                        <div>
                          {assigneeName && <span>👤 {assigneeName}</span>}
                          {assigneeName && m.notes && <span> · </span>}
                          {m.notes && <span className="whitespace-pre-wrap">{m.notes}</span>}
                        </div>
                        {m.completed_at && <div>Completed {fmtDateTime(m.completed_at)}</div>}
                        {m.verified && <div className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Verified by {staffName(m.verified_by)} · {fmtDateTime(m.verified_at)}</div>}
                      </div>
                    )}
                    {expandedMs[m.id] && (
                      <div className="ml-6 mt-2 border rounded-md p-2 bg-muted/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-medium">Documents</div>
                          <label className={`text-xs inline-flex items-center gap-1 px-2 py-1 rounded bg-primary text-primary-foreground cursor-pointer ${uploadingMs === m.id ? "opacity-60" : ""}`}>
                            <Upload className="h-3 w-3" /> {uploadingMs === m.id ? "Uploading…" : "Upload"}
                            <input type="file" hidden disabled={uploadingMs === m.id} onChange={e => { const f = e.target.files?.[0]; if (f) uploadMsDoc(m.id, f); e.target.value = ""; }} />
                          </label>
                        </div>
                        {(milestoneDocs[m.id] ?? []).length === 0 ? (
                          <div className="text-xs text-muted-foreground py-1">No documents yet.</div>
                        ) : (
                          <div className="divide-y">
                            {milestoneDocs[m.id].map((d: any) => (
                              <div key={d.id} className="flex items-center gap-2 py-1.5 text-xs">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <div className="flex-1 truncate">
                                  <div>{d.title}</div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {d.uploader?.full_name ?? "Unknown"} · {formatDate(d.created_at)}
                                    {d.verified && <> · ✔ verified by {staffName(d.verified_by)} {fmtDateTime(d.verified_at)}</>}
                                  </div>
                                </div>
                                <button onClick={() => verifyDoc(d, m.id)} className={`inline-flex items-center gap-1 ${d.verified ? "text-accent-foreground" : "text-muted-foreground"}`}>
                                  <ShieldCheck className="h-3 w-3" />{d.verified ? "Unverify" : "Verify"}
                                </button>
                                <button onClick={() => viewDoc(d.file_path, d.title)} className="text-primary inline-flex items-center gap-1"><Eye className="h-3 w-3" />View</button>
                                <button onClick={() => downloadDoc(d.file_path)} className="text-primary inline-flex items-center gap-1"><Download className="h-3 w-3" />Get</button>
                                {isAdmin && <button onClick={() => removeMsDoc(d.id, d.file_path, m.id)} className="text-destructive"><Trash2 className="h-3 w-3" /></button>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!editorClosed && (
              <div className="border-t pt-3 space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Add step / action</div>
                <input placeholder="Title *" value={msTitle} onChange={e => setMsTitle(e.target.value)} className="w-full h-9 px-3 rounded-md border bg-background text-sm" />
                <div className="grid grid-cols-3 gap-2">
                  <input type="date" value={msDue} onChange={e => setMsDue(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm" />
                  <select value={msAssignee} onChange={e => setMsAssignee(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm">
                    <option value="">Assign to…</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                  <select value={msStage} onChange={e => setMsStage(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm">
                    {STAGES.filter(s => s.key !== "closed").map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <textarea placeholder="Notes / action taken" value={msNotes} onChange={e => setMsNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-md border bg-background text-sm" />
                <button onClick={addMilestone} className="w-full h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm">Add</button>
              </div>
            )}

            <div className="border-t pt-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Close-out</div>
              {editorClosed ? (
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Closed by {staffName(milestoneEditor.closed_by)} on {fmtDateTime(milestoneEditor.closed_at)}</div>
                  <div className="flex items-center gap-2">Invoice: <LinkedInvoice invoiceId={milestoneEditor.invoice_id} /></div>
                  {milestoneEditor.closure_notes && <div className="whitespace-pre-wrap border rounded-md p-2 bg-muted/20">{milestoneEditor.closure_notes}</div>}
                  <button onClick={reopenProject} className="h-8 px-3 rounded-md border text-xs">Reopen project</button>
                </div>
              ) : (
                <>
                  <textarea placeholder="Closing summary: outcome, deliverables issued, client sign-off…" value={closureNotes} onChange={e => setClosureNotes(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-md border bg-background text-sm" />
                  {!milestoneEditor.invoice_id && <p className="text-[11px] text-muted-foreground">An invoice must be generated under the client to close this project.</p>}
                  <button onClick={closeProject} className="w-full h-9 rounded-md bg-accent text-accent-foreground text-sm font-medium">{milestoneEditor.invoice_id ? "Close project" : "Generate invoice & close project"}</button>
                  <CompletionInvoiceDialog
                    open={closeInvoiceOpen}
                    onOpenChange={setCloseInvoiceOpen}
                    source="service_projects"
                    sourceId={milestoneEditor.id}
                    clientName={milestoneEditor.clients?.company_name}
                    defaultDescription={`${moduleLabel} — ${milestoneEditor.title}`}
                    onInvoiced={finishClose}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
