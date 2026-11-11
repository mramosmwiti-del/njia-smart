import { CalendarCheck, CalendarClock, CalendarDays, CheckCircle2, Flag, MessageSquare } from "lucide-react";
import { daysUntil, formatDate, formatDateTime } from "@/lib/format";
import { weekLabel, weekOf, NO_WEEK } from "@/lib/task-weeks";
import type { TaskWorkspaceCtx } from "./use-task-workspace";
import { KIND_CLS, KIND_LABEL, type UpdateKind } from "./types";

// Key dates up top, then everything that happened, oldest first.
export function TimelinePanel({ ctx }: { ctx: TaskWorkspaceCtx }) {
  const { task, updates, subtasks, nameOf } = ctx;
  if (!task) return null;

  const d = daysUntil(task.due_date);
  const overdue = task.status !== "done" && d !== null && d < 0;
  const wk = weekOf(task);

  const dates: { icon: any; label: string; value: string; cls?: string }[] = [
    { icon: CalendarDays, label: "Created", value: formatDate(task.created_at) },
    ...(wk !== NO_WEEK ? [{ icon: CalendarClock, label: "Planned week", value: weekLabel(wk) }] : []),
    {
      icon: Flag,
      label: "Due",
      value: task.due_date
        ? `${formatDate(task.due_date)}${task.status === "done" ? "" : d === null ? "" : d < 0 ? ` · ${-d} day${d === -1 ? "" : "s"} overdue` : d === 0 ? " · today" : ` · in ${d} day${d === 1 ? "" : "s"}`}`
        : "No due date",
      cls: overdue ? "text-destructive" : "",
    },
    ...(task.completed_at ? [{ icon: CheckCircle2, label: "Completed", value: formatDateTime(task.completed_at) }] : []),
  ];

  const upcoming = subtasks.filter(s => !s.done && s.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date));

  // Group events by day.
  const groups: { day: string; items: any[] }[] = [];
  for (const u of updates) {
    const day = formatDate(u.created_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(u); else groups.push({ day, items: [u] });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {dates.map(x => (
          <div key={x.label} className="rounded-lg border p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><x.icon className="h-3.5 w-3.5" />{x.label}</div>
            <div className={`mt-0.5 text-sm font-medium ${x.cls ?? ""}`}>{x.value}</div>
          </div>
        ))}
      </div>

      {upcoming.length > 0 && (
        <div className="rounded-lg border p-3">
          <div className="text-xs font-medium mb-1.5 inline-flex items-center gap-1.5"><CalendarCheck className="h-3.5 w-3.5" /> Upcoming subtask dates</div>
          <ul className="space-y-1 text-sm">
            {upcoming.map(s => (
              <li key={s.id} className="flex justify-between gap-3">
                <span className="truncate">{s.title} <span className="text-muted-foreground">· {nameOf(s.assigned_to)}</span></span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(s.due_date)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="text-xs font-medium mb-2">History</div>
        {groups.length === 0 && <p className="text-sm text-muted-foreground">Nothing has happened yet.</p>}
        <div className="space-y-4">
          {groups.map(g => (
            <div key={g.day}>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">{g.day}</div>
              <ol className="relative border-l ml-2 space-y-3">
                {g.items.map(u => {
                  const k = (u.kind as UpdateKind) in KIND_LABEL ? (u.kind as UpdateKind) : "note";
                  const system = k === "system";
                  return (
                    <li key={u.id} className="ml-4 relative">
                      <span className={`absolute -left-[22px] top-1 h-3 w-3 rounded-full border-2 border-background ${system ? "bg-muted-foreground/60" : k === "guidance" ? "bg-emerald-500" : k === "report" ? "bg-amber-500" : "bg-primary"}`} />
                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                        {!system && <span className={`px-2 py-0.5 rounded-full ${KIND_CLS[k]}`}><MessageSquare className="inline h-3 w-3 mr-1" />{KIND_LABEL[k]}</span>}
                        <span>{nameOf(u.author_id)} · {new Date(u.created_at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <div className={`text-sm mt-0.5 whitespace-pre-wrap ${system ? "text-muted-foreground" : ""}`}>{u.body}</div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
