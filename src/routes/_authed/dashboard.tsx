import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, ClipboardCheck, Receipt, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatDate, daysUntil } from "@/lib/format";
import {
  ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/_authed/dashboard")({ component: Dashboard });

function Kpi({ icon: Icon, label, value, sub, tone, to }: any) {
  const content = (
    <div className="bg-card rounded-lg border p-4 h-full hover:border-primary/60 hover:shadow-sm transition">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        <Icon className={`h-4 w-4 ${tone ?? "text-muted-foreground"}`} />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function Dashboard() {
  const [stats, setStats] = useState({ clients: 0, pending: 0, overdue: 0, completed: 0, staff: 0 });
  const [statusMix, setStatusMix] = useState<{ name: string; value: number }[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [c, pendingTax, overdue, completedTasks, staff, clientList, taxRows, taskRows] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("tax_returns").select("id", { count: "exact", head: true }).in("status", ["pending", "in_progress"]),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("is_overdue", true),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "done"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("clients").select("status"),
        supabase.from("tax_returns").select("id, return_type, due_date, status, clients(company_name)").order("due_date").limit(6),
        supabase.from("tasks").select("id, title, due_date, priority, status").order("created_at", { ascending: false }).limit(6),
      ]);
      setStats({
        clients: c.count ?? 0,
        pending: pendingTax.count ?? 0,
        overdue: overdue.count ?? 0,
        completed: completedTasks.count ?? 0,
        staff: staff.count ?? 0,
      });
      const counts: Record<string, number> = {};
      (clientList.data ?? []).forEach((r: any) => { counts[r.status] = (counts[r.status] ?? 0) + 1; });
      setStatusMix(Object.entries(counts).map(([name, value]) => ({ name: name.replace(/_/g, " "), value })));
      setUpcoming(taxRows.data ?? []);
      setRecent(taskRows.data ?? []);
    })();
  }, []);

  const summary = stats.overdue > 0
    ? `Heads up — ${stats.overdue} task${stats.overdue > 1 ? "s are" : " is"} overdue. ${stats.pending} tax return${stats.pending !== 1 ? "s" : ""} pending across ${stats.clients} client${stats.clients !== 1 ? "s" : ""}.`
    : `All clear on overdue items. ${stats.pending} pending tax return${stats.pending !== 1 ? "s" : ""}, ${stats.completed} task${stats.completed !== 1 ? "s" : ""} completed.`;

  const COLORS = ["#363D97", "#F14B24", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#64748b"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">{summary}</p>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Kpi icon={Users} label="Clients" value={stats.clients} to="/clients" />
        <Kpi icon={Receipt} label="Pending Tax" value={stats.pending} tone="text-primary" to="/tax" />
        <Kpi icon={AlertTriangle} label="Overdue" value={stats.overdue} tone="text-destructive" to="/tasks" />
        <Kpi icon={CheckCircle2} label="Done Tasks" value={stats.completed} tone="text-emerald-600" to="/tasks" />
        <Kpi icon={ClipboardCheck} label="Staff" value={stats.staff} to="/team" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-card border rounded-lg p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Upcoming filings</h2>
            <Link to="/tax" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="space-y-2">
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming tax returns yet.</p>}
            {upcoming.map((r: any) => {
              const d = daysUntil(r.due_date);
              return (
                <Link key={r.id} to="/tax/$type" params={{ type: r.return_type }} className="flex items-center justify-between p-2 rounded hover:bg-muted">
                  <div>
                    <div className="text-sm font-medium uppercase">{r.return_type}</div>
                    <div className="text-xs text-muted-foreground">{r.clients?.company_name ?? "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">{formatDate(r.due_date)}</div>
                    <div className={`text-xs ${d !== null && d < 0 ? "text-destructive" : d !== null && d <= 3 ? "text-accent" : "text-muted-foreground"}`}>
                      {d === null ? "" : d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "Today" : `in ${d}d`}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <h2 className="font-semibold mb-3">Client status mix</h2>
          {statusMix.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clients yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusMix} dataKey="value" nameKey="name" outerRadius={70}>
                  {statusMix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recent tasks</h2>
          <Link to="/tasks" className="text-xs text-primary hover:underline">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b">
              <tr><th className="py-2">Task</th><th>Priority</th><th>Status</th><th>Due</th></tr>
            </thead>
            <tbody>
              {recent.length === 0 && <tr><td colSpan={4} className="py-4 text-muted-foreground">No tasks yet.</td></tr>}
              {recent.map((t: any) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/40 cursor-pointer" onClick={() => { window.location.href = "/tasks"; }}>
                  <td className="py-2">{t.title}</td>
                  <td><span className="capitalize">{t.priority}</span></td>
                  <td><span className="capitalize">{t.status.replace(/_/g, " ")}</span></td>
                  <td>{formatDate(t.due_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
