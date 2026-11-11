import { useState } from "react";
import { Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
import { formatDate, daysUntil } from "@/lib/format";
import type { TaskWorkspaceCtx } from "./use-task-workspace";
import { ProgressBar } from "./progress-bar";

// Subtasks: pieces of the task handed to teammates who assist.
export function SubtasksPanel({ ctx }: { ctx: TaskWorkspaceCtx }) {
  const { user, task, subtasks, people, isLead, nameOf, subtasksDone, addSubtask, toggleSubtask, reassignSubtask, removeSubtask } = ctx;
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const ok = await addSubtask(title, assignee, due);
    setSaving(false);
    if (ok) { setTitle(""); setAssignee(""); setDue(""); }
  }

  const pct = subtasks.length ? Math.round((subtasksDone / subtasks.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {subtasks.length > 0 && (
        <div className="rounded-lg border p-3 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{subtasksDone} of {subtasks.length} subtasks done</span>
          </div>
          <ProgressBar value={pct} />
        </div>
      )}

      {subtasks.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No subtasks yet. {isLead ? "Break the task into parts and hand them to the teammates who will help." : "The task owner can add subtasks and assign teammates to help."}
        </p>
      )}

      <ul className="space-y-2">
        {subtasks.map(s => {
          const mine = s.assigned_to === user?.id;
          const canToggle = isLead || mine;
          const d = daysUntil(s.due_date);
          const late = !s.done && d !== null && d < 0;
          return (
            <li key={s.id} className="flex items-start gap-3 rounded-lg border p-3">
              <button
                onClick={() => canToggle && toggleSubtask(s)}
                disabled={!canToggle}
                title={canToggle ? (s.done ? "Mark as not done" : "Mark as done") : "Only the owner or the assigned teammate can tick this"}
                className={`mt-0.5 ${canToggle ? "hover:text-primary" : "opacity-50 cursor-not-allowed"}`}
              >
                {s.done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${s.done ? "line-through text-muted-foreground" : ""}`}>{s.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {isLead ? (
                    <select
                      value={s.assigned_to || ""}
                      onChange={e => reassignSubtask(s, e.target.value)}
                      className="h-7 px-2 rounded border bg-background text-xs"
                    >
                      <option value="">Unassigned</option>
                      {people.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  ) : (
                    <span>{s.assigned_to ? nameOf(s.assigned_to) : "Unassigned"}{mine ? " (you)" : ""}</span>
                  )}
                  {s.due_date && <span className={late ? "text-destructive" : ""}>Due {formatDate(s.due_date)}{late ? " · overdue" : ""}</span>}
                  {s.done && s.done_at && <span>Done {formatDate(s.done_at)}</span>}
                </div>
              </div>
              {isLead && (
                <button onClick={() => removeSubtask(s)} title="Remove subtask" className="p-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {isLead && task?.status !== "done" && (
        <form onSubmit={add} className="rounded-lg border border-dashed p-3 space-y-2">
          <div className="text-xs font-medium">Add a subtask</div>
          <input
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full h-9 px-3 rounded-md border bg-background text-sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
            <select value={assignee} onChange={e => setAssignee(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm">
              <option value="">Assign to teammate (optional)</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
            <input type="date" value={due} onChange={e => setDue(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm" />
            <button disabled={saving} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center justify-center gap-1.5">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
