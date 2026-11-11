import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate, STATUS_COLORS } from "@/lib/format";
import {
  NO_WEEK, WEEK_BUSY, WEEK_OVERLOADED, addWeeks, mondayOf, weekLabel, weekOf, loadLevel, LEVEL_CLS, LEVEL_LABEL,
} from "@/lib/task-weeks";

export type PlanTask = {
  id: string;
  title: string;
  assigned_to: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  week_start: string | null;
  clients?: { company_name: string } | null;
};

type Person = { id: string; full_name: string | null };

const UNASSIGNED = "__unassigned__";

/**
 * Weekly plan (Director/Admin): who is occupied in which week, so tasks can be
 * given to someone with room instead of overloading one person. Counts open
 * (not done) tasks by planned week, or by due-date week when none is planned.
 */
export function TaskWeeklyPlan({
  tasks, staff, onReassign, onOpenTask,
}: {
  tasks: PlanTask[];
  staff: Person[];
  onReassign: (taskId: string, userId: string | null, title: string) => Promise<void>;
  onOpenTask: (id: string) => void;
}) {
  const [start, setStart] = useState(() => mondayOf(new Date())!);
  const [picked, setPicked] = useState<{ uid: string; week: string } | null>(null);

  const weeks = useMemo(() => [0, 1, 2, 3].map(i => addWeeks(start, i)), [start]);
  const thisWeek = mondayOf(new Date())!;
  const columns = [...weeks, NO_WEEK];

  const key = (uid: string | null) => uid ?? UNASSIGNED;
  const cell = (uid: string, week: string) => tasks.filter(t => key(t.assigned_to) === uid && weekOf(t) === week);
  const countFor = (uid: string, week: string, excludeId?: string) =>
    tasks.filter(t => key(t.assigned_to) === uid && weekOf(t) === week && t.id !== excludeId).length;

  const people = useMemo(() => [...staff].sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "")), [staff]);
  const hasUnassigned = tasks.some(t => !t.assigned_to);
  const nameOf = (uid: string) => uid === UNASSIGNED ? "Unassigned" : people.find(p => p.id === uid)?.full_name ?? "Unknown";

  const pickedTasks = picked ? cell(picked.uid, picked.week) : [];

  const renderRow = (uid: string, name: string) => {
    return (
      <tr key={uid} className="border-b last:border-0">
        <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium whitespace-nowrap">{name}</td>
        {columns.map(w => {
          const n = cell(uid, w).length;
          const lvl = loadLevel(n);
          const active = picked?.uid === uid && picked.week === w;
          return (
            <td key={w} className="px-1.5 py-1.5 text-center">
              <button
                type="button"
                onClick={() => setPicked(active ? null : { uid, week: w })}
                disabled={n === 0}
                title={n === 0 ? "Nothing planned" : `${n} open task${n === 1 ? "" : "s"} — click to see them`}
                className={`w-full min-w-[4.5rem] rounded-md px-2 py-1.5 text-xs font-medium transition ${uid === UNASSIGNED && n > 0 ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200" : LEVEL_CLS[lvl]} ${active ? "ring-2 ring-primary" : ""} ${n === 0 ? "cursor-default" : "hover:opacity-80"}`}
              >
                {n === 0 ? "—" : n}
              </button>
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => { setStart(addWeeks(start, -1)); setPicked(null); }} className="h-8 w-8 rounded-md border inline-flex items-center justify-center hover:bg-muted" aria-label="Earlier weeks"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => { setStart(thisWeek); setPicked(null); }} className="h-8 px-3 rounded-md border text-xs hover:bg-muted">This week</button>
          <button type="button" onClick={() => { setStart(addWeeks(start, 1)); setPicked(null); }} className="h-8 w-8 rounded-md border inline-flex items-center justify-center hover:bg-muted" aria-label="Later weeks"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">Open tasks per week:</span>
          <span className={`rounded-full px-2 py-0.5 ${LEVEL_CLS.light}`}>Light 1–{WEEK_BUSY - 1}</span>
          <span className={`rounded-full px-2 py-0.5 ${LEVEL_CLS.busy}`}>Busy {WEEK_BUSY}–{WEEK_OVERLOADED - 1}</span>
          <span className={`rounded-full px-2 py-0.5 ${LEVEL_CLS.overloaded}`}>Overloaded {WEEK_OVERLOADED}+</span>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground border-b">
              <tr>
                <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left font-medium">Staff</th>
                {columns.map(w => (
                  <th key={w} className="px-1.5 py-2 text-center font-medium whitespace-nowrap">
                    <div className={w === thisWeek ? "text-primary" : ""}>{w === NO_WEEK ? "No week" : weekLabel(w)}</div>
                    {w === thisWeek && <div className="text-[10px] font-normal text-primary">this week</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.length === 0 && <tr><td colSpan={columns.length + 1} className="py-8 text-center text-muted-foreground">No staff to plan.</td></tr>}
              {people.map(p => renderRow(p.id, p.full_name ?? "Unnamed"))}
              {hasUnassigned && renderRow(UNASSIGNED, "Unassigned")}
            </tbody>
          </table>
        </div>
      </div>

      {picked && (
        <div className="bg-card border rounded-lg p-4 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold text-sm">{nameOf(picked.uid)} · {weekLabel(picked.week)}</h3>
            <button type="button" onClick={() => setPicked(null)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
          </div>
          <p className="text-xs text-muted-foreground">Give a task to someone with more room that week.</p>
          <div className="divide-y">
            {pickedTasks.map(t => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <button type="button" onClick={() => onOpenTask(t.id)} className="font-medium hover:text-primary text-left">{t.title}</button>
                  <div className="text-xs text-muted-foreground">
                    {t.clients?.company_name ? `${t.clients.company_name} · ` : ""}
                    <span className="capitalize">{t.priority}</span> · due {formatDate(t.due_date)} ·{" "}
                    <span className={`px-1.5 rounded capitalize ${STATUS_COLORS[t.status] ?? ""}`}>{t.status.replace(/_/g, " ")}</span>
                  </div>
                </div>
                <select
                  value=""
                  onChange={e => { if (e.target.value) void onReassign(t.id, e.target.value === UNASSIGNED ? null : e.target.value, t.title); }}
                  className="h-8 px-2 rounded-md border bg-background text-xs"
                  aria-label={`Give "${t.title}" to`}
                >
                  <option value="">Give to…</option>
                  {people.filter(p => p.id !== t.assigned_to).map(p => {
                    const n = countFor(p.id, picked.week, t.id);
                    const lvl = loadLevel(n);
                    return <option key={p.id} value={p.id}>{p.full_name} · {n} that week ({LEVEL_LABEL[lvl]})</option>;
                  })}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
