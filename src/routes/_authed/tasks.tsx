import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { notifyUser } from "@/lib/notify";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X, Pencil, Trash2, MessageSquare, CalendarRange, ListTodo } from "lucide-react";
import { formatDate, formatDateTime, daysUntil, STATUS_COLORS } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { LastUpdated } from "@/components/last-updated";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { TaskWeeklyPlan, type PlanTask } from "@/components/task-weekly-plan";
import { TaskWorkspace } from "@/components/task-workspace/task-workspace";
import { ProgressBar } from "@/components/task-workspace/progress-bar";
import { displayProgress } from "@/components/task-workspace/types";
import { NO_WEEK, WEEK_BUSY, mondayOf, weekLabel, weekOf, loadLevel, LEVEL_CLS, LEVEL_LABEL } from "@/lib/task-weeks";

export const Route = createFileRoute("/_authed/tasks")({
  component: TasksPage,
  validateSearch: (s: Record<string, unknown>) => ({
    status: typeof s.status === "string" ? s.status : undefined,
    overdue: s.overdue === true || s.overdue === "true" ? true : undefined,
    task: typeof s.task === "string" ? s.task : undefined,
  }),
});

const EMPTY = { id: "", title:"", description:"", client_id:"", assigned_to:"", supervisor_id:"", priority:"normal", due_date:"", week_start:"", status:"todo" };

function TasksPage() {
  const { user, isAdmin, canDelete } = useAuth();
  const { status: statusFilter, overdue: overdueFilter, task: taskParam } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [rows, setRows] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [detailId, setDetailId] = useState<string|null>(null);
  // Which of my tasks to show: all, assigned to me, tasks where I am a helper, tasks I supervise, tasks waiting for guidance.
  const [view, setView] = useState<"all" | "mine" | "helping" | "supervising" | "guidance">("all");
  const [helpingIds, setHelpingIds] = useState<Set<string>>(new Set());
  const [subCounts, setSubCounts] = useState<Map<string, { done: number; total: number }>>(new Map());
  // Director/Admin only: every open task, for the weekly plan and the workload hints.
  const [tab, setTab] = useState<"list" | "plan">("list");
  const [planTasks, setPlanTasks] = useState<PlanTask[]>([]);

  async function load() {
    // A task shows up for: the person it is assigned to, the person who gave it,
    // its supervisor, and any teammate holding a subtask on it.
    let helping = new Set<string>();
    if (user?.id) {
      const mineSub = await supabase.from("task_subtasks").select("task_id").eq("assigned_to", user.id);
      helping = new Set((mineSub.data ?? []).map((r: any) => r.task_id as string));
    }
    let taskQuery = supabase.from("tasks").select("*, clients(company_name)").order("due_date", { ascending: true, nullsFirst: false });
    if (user?.id) {
      const parts = [`assigned_to.eq.${user.id}`, `created_by.eq.${user.id}`, `supervisor_id.eq.${user.id}`];
      if (helping.size) parts.push(`id.in.(${[...helping].join(",")})`);
      taskQuery = taskQuery.or(parts.join(","));
    }
    const planQuery = isAdmin
      ? supabase.from("tasks").select("id, title, assigned_to, priority, status, due_date, week_start, clients(company_name)").neq("status", "done")
      : null;
    const [t, c, s, plan] = await Promise.all([
      taskQuery,
      supabase.from("clients").select("id, company_name").order("company_name"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
      planQuery ?? Promise.resolve({ data: [] as any[], error: null }),
    ]);
    if (t.error) toast.error(t.error.message);
    const staffList = s.data ?? [];
    const byId = new Map(staffList.map((p: any) => [p.id, p]));
    const tasksWithAssignee = (t.data ?? []).map((row: any) => ({
      ...row,
      profiles: row.assigned_to ? byId.get(row.assigned_to) ?? null : null,
    }));
    // Subtask counts for the progress label ("2 of 5").
    const ids = tasksWithAssignee.map((r: any) => r.id);
    const counts = new Map<string, { done: number; total: number }>();
    if (ids.length) {
      const subs = await supabase.from("task_subtasks").select("task_id, done").in("task_id", ids);
      for (const r of (subs.data ?? []) as any[]) {
        const cur = counts.get(r.task_id) ?? { done: 0, total: 0 };
        cur.total += 1; if (r.done) cur.done += 1;
        counts.set(r.task_id, cur);
      }
    }
    setRows(tasksWithAssignee); setClients(c.data ?? []); setStaff(staffList);
    setHelpingIds(helping); setSubCounts(counts);
    setPlanTasks(((plan as any).data ?? []) as PlanTask[]);
  }
  useEffect(()=>{ load(); }, [user?.id, isAdmin]);
  useLiveRefresh(["tasks", "task_subtasks"], load);

  // Deep link from a notification: /tasks?task=<id> opens that task's workspace.
  useEffect(() => { if (taskParam) setDetailId(taskParam); }, [taskParam]);
  function closeWorkspace() {
    setDetailId(null);
    if (taskParam) navigate({ search: { status: statusFilter, overdue: overdueFilter, task: undefined } });
  }

  function openNew() { setForm(EMPTY); setOpen(true); }
  function openEdit(r: any) {
    setForm({ id: r.id, title:r.title, description:r.description||"", client_id:r.client_id||"", assigned_to:r.assigned_to||"", supervisor_id:r.supervisor_id||"", priority:r.priority, due_date:r.due_date||"", week_start:r.week_start||"", status:r.status });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return toast.error("Only a director or admin can give or change tasks.");
    if (!form.description.trim()) return toast.error("Say what should be done.");
    const payload: any = {
      title: form.title, description: form.description,
      client_id: form.client_id || null, assigned_to: form.assigned_to || null, supervisor_id: form.supervisor_id || null,
      priority: form.priority, due_date: form.due_date || null, status: form.status,
      week_start: mondayOf(form.week_start) ?? null,
    };
    if (form.id) {
      const { error } = await supabase.from("tasks").update(payload).eq("id", form.id);
      if (error) return toast.error(error.message);
      toast.success("Task updated");
    } else {
      payload.created_by = user?.id;
      const { error } = await supabase.from("tasks").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Task created");
    }
    if (form.assigned_to && form.assigned_to !== user?.id) {
      const wk = mondayOf(form.week_start) ?? mondayOf(form.due_date);
      await notifyUser({ user_id: form.assigned_to, type:"task_assigned", title: form.id ? "Task updated" : "New task assigned", body: `${form.title}${wk ? ` — week of ${weekLabel(wk)}` : ""}` });
    }
    setOpen(false); setForm(EMPTY); load();
  }

  // Director/Admin only (also enforced in the database).
  async function reassign(id: string, newAssignee: string | null, title: string) {
    const { error } = await supabase.from("tasks").update({ assigned_to: newAssignee }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (newAssignee && newAssignee !== user?.id) {
      await notifyUser({ user_id: newAssignee, type:"task_transferred", title:"Task transferred to you", body: title });
    }
    toast.success("Reassigned"); load();
  }

  // Open tasks a person already has in a week (for the "who has room" hints).
  const openIn = (uid: string, week: string, excludeId?: string) =>
    planTasks.filter(x => x.assigned_to === uid && weekOf(x) === week && x.id !== excludeId).length;
  const loadHint = (uid: string, week: string, excludeId?: string) =>
    week === NO_WEEK ? "" : ` · ${openIn(uid, week, excludeId)} that week`;
  const formWeek = mondayOf(form.week_start) ?? mondayOf(form.due_date) ?? NO_WEEK;
  const nameOf = (id?: string | null) => (id ? staff.find((p: any) => p.id === id)?.full_name : null) || null;

  async function remove(id: string) {
    if (!confirm("Delete this task?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  }

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("tasks").update({ status: status as any }).eq("id", id);
    if (error) toast.error(error.message); else load();
  }

  const iSupervise = (r: any) => r.supervisor_id === user?.id || (r.created_by === user?.id && r.assigned_to !== user?.id);
  const iHelp = (r: any) => helpingIds.has(r.id) && r.assigned_to !== user?.id;
  const needsMyGuidance = (r: any) => r.needs_guidance && (iSupervise(r) || isAdmin);
  const viewCounts = {
    all: rows.length,
    mine: rows.filter(r => r.assigned_to === user?.id).length,
    helping: rows.filter(iHelp).length,
    supervising: rows.filter(iSupervise).length,
    guidance: rows.filter(needsMyGuidance).length,
  };
  const visible = rows.filter(r =>
    (view === "all" || (view === "mine" && r.assigned_to === user?.id) || (view === "helping" && iHelp(r)) ||
      (view === "supervising" && iSupervise(r)) || (view === "guidance" && needsMyGuidance(r))) &&
    (!statusFilter || r.status === statusFilter) &&
    (!overdueFilter || (r.status !== "done" && r.is_overdue === true))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Give tasks to staff, plan their weeks and avoid overloading one person. Open any task to work on it with your team." : "Your workspace: tasks given to you, tasks you are helping with, and tasks you supervise."}
            {(statusFilter || overdueFilter) && (
              <>
                {" "}· filtered to <span className="font-medium capitalize text-foreground">{overdueFilter ? "overdue" : statusFilter?.replace(/_/g, " ")}</span>{" "}
                <button onClick={() => navigate({ search: { status: undefined, overdue: undefined } })} className="text-primary hover:underline">clear</button>
              </>
            )}
          </p>
        </div>
        {isAdmin && (
          <button onClick={openNew} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-2"><Plus className="h-4 w-4" /> Give task</button>
        )}
      </div>

      {isAdmin && (
        <div className="flex gap-1 border-b">
          {([["list", "Tasks", ListTodo], ["plan", "Weekly plan", CalendarRange]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 text-sm inline-flex items-center gap-1.5 border-b-2 -mb-px ${tab === k ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      )}

      {(!isAdmin || tab === "list") && (
        <div className="flex flex-wrap gap-1.5">
          {([["all", "All"], ["mine", "Assigned to me"], ["helping", "Helping"], ["supervising", "Supervising"], ["guidance", "Needs guidance"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={`text-xs px-2.5 py-1 rounded-full border ${view === k ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
            >
              {label}{viewCounts[k] ? <span className="ml-1 opacity-80">{viewCounts[k]}</span> : null}
            </button>
          ))}
        </div>
      )}

      {isAdmin && tab === "plan" && (
        <TaskWeeklyPlan tasks={planTasks} staff={staff} onReassign={reassign} onOpenTask={setDetailId} />
      )}

      {(!isAdmin || tab === "list") && (
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground border-b">
              <tr><th className="py-2 px-3">Task</th><th>Client</th><th>Assignee</th><th className="w-36">Progress</th><th>Week</th><th>Priority</th><th>Due</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {visible.length===0 && <tr><td colSpan={9} className="py-10 text-center text-muted-foreground">No tasks.</td></tr>}
              {visible.map(t=>{
                const d = daysUntil(t.due_date);
                const isUrgent = d !== null && d >= 0 && d <= 2 && t.status !== "done";
                return (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">
                      <button onClick={()=>setDetailId(t.id)} className="hover:text-primary text-left">{t.title}</button>
                      {t.created_by && t.created_by !== t.assigned_to && nameOf(t.created_by) && (
                        <div className="text-[10px] font-normal text-muted-foreground">Given by {nameOf(t.created_by)}</div>
                      )}
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {iHelp(t) && <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200 font-normal">Helping</span>}
                        {iSupervise(t) && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-normal">Supervising</span>}
                        {t.needs_guidance && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 font-normal">Awaiting guidance</span>}
                      </div>
                    </td>
                    <td className="text-xs text-muted-foreground">{t.clients?.company_name || "—"}</td>
                    <td className="text-xs">
                      {isAdmin ? (
                        <select value={t.assigned_to || ""} onChange={e => reassign(t.id, e.target.value || null, t.title)} className="h-7 px-2 rounded text-xs border bg-background">
                          <option value="">Unassigned</option>
                          {staff.map((s: any) => <option key={s.id} value={s.id}>{s.full_name}{loadHint(s.id, weekOf(t), t.id)}</option>)}
                        </select>
                      ) : (
                        <span>{t.profiles?.full_name || "Unassigned"}</span>
                      )}
                    </td>
                    <td className="pr-3">
                      <ProgressBar value={displayProgress(t)} size="sm" />
                      {subCounts.get(t.id) && <div className="text-[10px] text-muted-foreground">{subCounts.get(t.id)!.done} of {subCounts.get(t.id)!.total} subtasks</div>}
                    </td>
                    <td className="text-xs whitespace-nowrap">{weekOf(t) === NO_WEEK ? "—" : weekLabel(weekOf(t))}</td>
                    <td><span className={`text-xs px-2 py-0.5 rounded capitalize ${isUrgent ? STATUS_COLORS.urgent : STATUS_COLORS[t.priority]}`}>{isUrgent ? "urgent" : t.priority}</span></td>
                    <td className="text-xs">{formatDate(t.due_date)}{t.is_overdue && <div className="text-destructive">overdue</div>}</td>
                    <td>
                      <select value={t.status} onChange={e=>setStatus(t.id, e.target.value)} className={`h-7 px-2 rounded text-xs border bg-background capitalize ${STATUS_COLORS[t.status]}`}>
                        {["todo","in_progress","blocked","done"].map(s=><option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
                      </select>
                      {t.status === "done" && t.completed_at ? (
                        <div className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">Done {formatDateTime(t.completed_at)}</div>
                      ) : (
                        <LastUpdated at={t.updated_at} byName={t.updated_by ? staff.find((s: any) => s.id === t.updated_by)?.full_name : null} className="block mt-0.5 text-[10px] whitespace-nowrap" />
                      )}
                    </td>
                    <td className="pr-2 text-right space-x-1 whitespace-nowrap">
                      <button onClick={()=>setDetailId(t.id)} title="Open workspace" className="p-1 hover:text-primary"><MessageSquare className="h-3.5 w-3.5" /></button>
                      {isAdmin && <button onClick={()=>openEdit(t)} title="Edit" className="p-1 hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>}
                      {canDelete("tasks", { createdBy: t.created_by }) && <button onClick={()=>remove(t.id)} title="Delete" className="p-1 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {open && isAdmin && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={()=>setOpen(false)}>
          <form onClick={e=>e.stopPropagation()} onSubmit={save} className="bg-card w-full max-w-md rounded-lg p-6 space-y-3">
            <div className="flex justify-between"><h2 className="text-lg font-semibold">{form.id ? "Edit task" : "Give task"}</h2><button type="button" onClick={()=>setOpen(false)}><X className="h-4 w-4" /></button></div>
            <input required placeholder="Title" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} className="w-full h-9 px-3 rounded-md border bg-background text-sm" />
            <textarea required placeholder="What should be done? Say it clearly so the person knows exactly what is expected." value={form.description} onChange={e=>setForm({...form, description:e.target.value})} rows={4} className="w-full px-3 py-2 rounded-md border bg-background text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <select value={form.client_id} onChange={e=>setForm({...form, client_id:e.target.value})} className="h-9 px-3 rounded-md border bg-background text-sm"><option value="">No client</option>{clients.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}</select>
              <select value={form.assigned_to} onChange={e=>setForm({...form, assigned_to:e.target.value})} className="h-9 px-3 rounded-md border bg-background text-sm"><option value="">Unassigned</option>{staff.map(s=><option key={s.id} value={s.id}>{s.full_name}{loadHint(s.id, formWeek, form.id || undefined)}</option>)}</select>
              <select value={form.priority} onChange={e=>setForm({...form, priority:e.target.value})} className="h-9 px-3 rounded-md border bg-background text-sm">{["low","normal","high","urgent"].map(p=><option key={p}>{p}</option>)}</select>
              <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} className="h-9 px-3 rounded-md border bg-background text-sm capitalize">{["todo","in_progress","blocked","done"].map(s=><option key={s} value={s}>{s.replace(/_/g," ")}</option>)}</select>
              <label className="text-xs text-muted-foreground">Due date
                <input type="date" value={form.due_date} onChange={e=>setForm({...form, due_date:e.target.value})} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm text-foreground" />
              </label>
              <label className="text-xs text-muted-foreground">Plan for week (any day in it)
                <input type="date" value={form.week_start} onChange={e=>setForm({...form, week_start:e.target.value})} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm text-foreground" />
              </label>
            </div>
            <label className="block text-xs text-muted-foreground">Supervisor (gives guidance on this task)
              <select value={form.supervisor_id} onChange={e=>setForm({...form, supervisor_id:e.target.value})} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm text-foreground">
                <option value="">Me (the person giving the task)</option>
                {staff.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </label>
            {formWeek !== NO_WEEK && (
              <div className="text-xs text-muted-foreground">Week: <span className="font-medium text-foreground">{weekLabel(formWeek)}</span>{!form.week_start && " (from the due date)"}</div>
            )}
            {form.assigned_to && formWeek !== NO_WEEK && (() => {
              const n = openIn(form.assigned_to, formWeek, form.id || undefined);
              const lvl = loadLevel(n);
              const roomier = staff
                .filter((p: any) => p.id !== form.assigned_to)
                .map((p: any) => ({ p, n: openIn(p.id, formWeek, form.id || undefined) }))
                .sort((a: any, b: any) => a.n - b.n)
                .slice(0, 3);
              return (
                <div className={`rounded-md px-3 py-2 text-xs ${LEVEL_CLS[lvl]}`}>
                  {nameOf(form.assigned_to)} already has {n} open task{n === 1 ? "" : "s"} that week ({LEVEL_LABEL[lvl]}).
                  {n + 1 >= WEEK_BUSY && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span>More room:</span>
                      {roomier.map(({ p, n: c }: any) => (
                        <button key={p.id} type="button" onClick={() => setForm({ ...form, assigned_to: p.id })} className="rounded border bg-background px-1.5 py-0.5 text-foreground hover:bg-muted">{p.full_name} ({c})</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
            <button className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium">{form.id ? "Save changes" : "Create task"}</button>
          </form>
        </div>
      )}

      {detailId && <TaskWorkspace id={detailId} onClose={closeWorkspace} />}
    </div>
  );
}
