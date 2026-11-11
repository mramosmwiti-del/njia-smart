import { useState } from "react";
import { Trash2, Send } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { TaskWorkspaceCtx } from "./use-task-workspace";
import { ACTION_LABEL, GUIDANCE_ACTIONS, KIND_CLS, KIND_LABEL, type UpdateKind } from "./types";

type ComposeKind = "note" | "feedback" | "report" | "guidance";

// Notes, feedback, progress reports for the supervisor, and the supervisor's guidance.
export function UpdatesPanel({ ctx }: { ctx: TaskWorkspaceCtx }) {
  const { user, isAdmin, task, updates, isSupervisor, nameOf, postUpdate, removeUpdate } = ctx;
  const [kind, setKind] = useState<ComposeKind>("note");
  const [text, setText] = useState("");
  const [action, setAction] = useState("continue");
  const [askGuidance, setAskGuidance] = useState(true);
  const [sending, setSending] = useState(false);

  const supervisorName = nameOf(task?.supervisor_id || task?.created_by);
  const kinds: ComposeKind[] = isSupervisor ? ["note", "feedback", "report", "guidance"] : ["note", "feedback", "report"];
  const feed = updates.filter(u => u.kind !== "system");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    const ok = await postUpdate(kind, text, { action, askGuidance });
    setSending(false);
    if (ok) setText("");
  }

  return (
    <div className="space-y-4">
      {task?.needs_guidance && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm">
          {isSupervisor
            ? "This task is waiting for your guidance. Read the latest report below and reply with the way forward."
            : `Waiting for guidance from ${supervisorName}.`}
        </div>
      )}

      <form onSubmit={send} className="rounded-lg border p-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {kinds.map(k => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`text-xs px-2.5 py-1 rounded-full border ${kind === k ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <textarea
          required
          rows={3}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={
            kind === "report" ? `What is done, what is left, and what is blocking you? This goes to ${supervisorName}.`
            : kind === "guidance" ? "Give the way forward: what to do next, what to change, what to watch for."
            : kind === "feedback" ? "Feedback on the work so far…"
            : "Add a note for the people on this task…"
          }
          className="w-full px-3 py-2 rounded-md border bg-background text-sm"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs">
            {kind === "report" && (
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={askGuidance} onChange={e => setAskGuidance(e.target.checked)} />
                I need guidance from {supervisorName}
              </label>
            )}
            {kind === "guidance" && (
              <select value={action} onChange={e => setAction(e.target.value)} className="h-8 px-2 rounded border bg-background text-xs">
                {GUIDANCE_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            )}
          </div>
          <button disabled={sending} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1.5">
            <Send className="h-3.5 w-3.5" /> Post
          </button>
        </div>
      </form>

      {feed.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}

      <ul className="space-y-2">
        {[...feed].reverse().map(u => {
          const k = (u.kind as UpdateKind) in KIND_LABEL ? (u.kind as UpdateKind) : "note";
          const canDelete = u.author_id === user?.id || isAdmin;
          return (
            <li key={u.id} className={`rounded-lg border p-3 ${k === "guidance" ? "border-emerald-300" : ""}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className={`px-2 py-0.5 rounded-full ${KIND_CLS[k]}`}>{KIND_LABEL[k]}</span>
                {u.action && <span className="px-2 py-0.5 rounded-full bg-muted">{ACTION_LABEL[u.action] ?? u.action}</span>}
                {u.ask_guidance && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Guidance requested</span>}
                <span>{nameOf(u.author_id)} · {formatDateTime(u.created_at)}</span>
                {canDelete && (
                  <button onClick={() => removeUpdate(u.id)} title="Delete" className="ml-auto p-1 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="mt-1.5 text-sm whitespace-pre-wrap">{u.body}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
