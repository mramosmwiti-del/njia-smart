import { useRef, useState } from "react";
import { Download, FileText, Star, Trash2, Upload } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { TaskWorkspaceCtx } from "./use-task-workspace";

// Outputs: the document(s) that are the outcome of the task.
export function OutputsPanel({ ctx }: { ctx: TaskWorkspaceCtx }) {
  const { user, outputs, isLead, busy, nameOf, uploadOutput, markFinal, removeOutput, openOutput } = ctx;
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [isFinal, setIsFinal] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    const ok = await uploadOutput(file, note, isFinal);
    if (ok) {
      setFile(null); setNote(""); setIsFinal(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const finals = outputs.filter(o => o.is_final);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 text-sm">
        {finals.length > 0
          ? <span className="text-emerald-700 dark:text-emerald-300">Final outcome: {finals.map(o => o.file_name).join(", ")}</span>
          : <span className="text-muted-foreground">No final outcome yet. Upload the document that is the result of this task and mark it as final.</span>}
      </div>

      <form onSubmit={submit} className="rounded-lg border border-dashed p-3 space-y-2">
        <div className="text-xs font-medium">Add an output</div>
        <input ref={fileRef} type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Short note about this file (optional)"
          className="w-full h-9 px-3 rounded-md border bg-background text-sm"
        />
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs inline-flex items-center gap-1.5">
            <input type="checkbox" checked={isFinal} onChange={e => setIsFinal(e.target.checked)} />
            This is the final outcome of the task
          </label>
          <button disabled={!file || busy} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1.5 disabled:opacity-50">
            <Upload className="h-4 w-4" /> {busy ? "Uploading…" : "Upload"}
          </button>
        </div>
      </form>

      {outputs.length === 0 && <p className="text-sm text-muted-foreground">No outputs uploaded yet.</p>}

      <ul className="space-y-2">
        {outputs.map(o => (
          <li key={o.id} className="flex items-start gap-3 rounded-lg border p-3">
            <FileText className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium break-all">
                {o.file_name}
                {o.is_final && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 align-middle">Final outcome</span>}
              </div>
              {o.note && <div className="text-xs text-muted-foreground mt-0.5">{o.note}</div>}
              <div className="text-xs text-muted-foreground mt-0.5">{nameOf(o.uploaded_by)} · {formatDateTime(o.created_at)}</div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => openOutput(o)} title="Open / download" className="p-1.5 hover:text-primary"><Download className="h-4 w-4" /></button>
              {isLead && !o.is_final && (
                <button onClick={() => markFinal(o)} title="Mark as final outcome" className="p-1.5 hover:text-primary"><Star className="h-4 w-4" /></button>
              )}
              {(isLead || o.uploaded_by === user?.id) && (
                <button onClick={() => removeOutput(o)} title="Delete" className="p-1.5 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
