import { formatDate } from "@/lib/format";
import type { TaskWorkspaceCtx } from "./use-task-workspace";
import { ACTION_LABEL } from "./types";

// What the task is, who is on it, and the latest word from the supervisor.
export function OverviewPanel({ ctx }: { ctx: TaskWorkspaceCtx }) {
  const { task, subtasks, updates, outputs, nameOf, subtasksDone } = ctx;
  if (!task) return null;

  const latestGuidance = [...updates].reverse().find(u => u.kind === "guidance");
  const helpers = [...new Set(subtasks.map(s => s.assigned_to).filter(Boolean))] as string[];

  const rows: [string, string][] = [
    ["Client", task.clients?.company_name || "—"],
    ["Assigned to", nameOf(task.assigned_to)],
    ["Given by", nameOf(task.created_by)],
    ["Supervisor", task.supervisor_id ? nameOf(task.supervisor_id) : task.created_by ? `${nameOf(task.created_by)} (giver)` : "—"],
    ["Priority", task.priority],
    ["Due", formatDate(task.due_date)],
  ];

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-medium mb-1">What should be done</div>
        <p className="text-sm whitespace-pre-wrap text-muted-foreground">{task.description || "No description."}</p>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-lg border p-2.5">
            <dt className="text-[11px] text-muted-foreground">{k}</dt>
            <dd className="text-sm font-medium capitalize">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border p-2.5"><div className="text-lg font-semibold">{subtasks.length ? `${subtasksDone}/${subtasks.length}` : "—"}</div><div className="text-[11px] text-muted-foreground">Subtasks done</div></div>
        <div className="rounded-lg border p-2.5"><div className="text-lg font-semibold">{helpers.length}</div><div className="text-[11px] text-muted-foreground">Teammates helping</div></div>
        <div className="rounded-lg border p-2.5"><div className="text-lg font-semibold">{outputs.length}</div><div className="text-[11px] text-muted-foreground">Outputs</div></div>
      </div>

      {helpers.length > 0 && (
        <div className="text-xs text-muted-foreground">Helping: <span className="text-foreground">{helpers.map(id => nameOf(id)).join(", ")}</span></div>
      )}

      {latestGuidance && (
        <div className="rounded-lg border border-emerald-300 p-3">
          <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            Latest guidance from {nameOf(latestGuidance.author_id)} · {formatDate(latestGuidance.created_at)}
            {latestGuidance.action ? ` · ${ACTION_LABEL[latestGuidance.action] ?? latestGuidance.action}` : ""}
          </div>
          <div className="text-sm mt-1 whitespace-pre-wrap">{latestGuidance.body}</div>
        </div>
      )}
    </div>
  );
}
