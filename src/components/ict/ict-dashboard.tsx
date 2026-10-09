import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity, AlertTriangle, ArrowRight, BriefcaseBusiness, CalendarClock,
  CheckCircle2, CircleDollarSign, ClipboardList, HardDrive, RefreshCw,
  Ticket, TrendingUp, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Project = {
  id: string;
  title: string;
  status: string | null;
  stage: string | null;
  due_date: string | null;
  created_at: string;
  clients?: { company_name?: string | null } | null;
  service_milestones?: { id: string; title: string; due_date: string | null; done: boolean | null }[] | null;
};
type TicketRow = {
  id: string;
  ticket_number: string | null;
  title: string;
  priority: string | null;
  status: string;
  created_at: string;
};
type DashboardData = {
  projects: Project[];
  tickets: TicketRow[];
  projectCount: number;
  openProjects: number;
  overdueMilestones: number;
  ticketCount: number;
  criticalTickets: number;
  assetsCount: number;
  invoiceOutstanding: number;
  invoiceBalance: number;
  clientsCount: number;
};

const emptyData: DashboardData = {
  projects: [], tickets: [], projectCount: 0, openProjects: 0,
  overdueMilestones: 0, ticketCount: 0, criticalTickets: 0,
  assetsCount: 0, invoiceOutstanding: 0, invoiceBalance: 0, clientsCount: 0,
};
const today = () => new Date().toISOString().slice(0, 10);
const money = (amount: number) => new Intl.NumberFormat("en-KE", {
  style: "currency", currency: "KES", maximumFractionDigits: 0,
}).format(amount);
const dateLabel = (value?: string | null) => value
  ? new Date(value).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })
  : "No due date";

function Metric({ label, value, detail, icon: Icon, href, tone = "default" }: {
  label: string; value: string | number; detail: string; icon: typeof Activity;
  href: string; tone?: "default" | "warning" | "danger" | "success";
}) {
  const toneClass = tone === "danger" ? "text-destructive bg-destructive/10" : tone === "warning"
    ? "text-amber-700 bg-amber-500/10 dark:text-amber-300" : tone === "success"
      ? "text-emerald-700 bg-emerald-500/10 dark:text-emerald-300" : "text-primary bg-primary/10";
  return (
    <Link to={href as never} className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <span className={`rounded-lg p-2 ${toneClass}`}><Icon className="h-5 w-5" /></span>
      </div>
      <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary opacity-80 group-hover:opacity-100">View details <ArrowRight className="h-3.5 w-3.5" /></div>
    </Link>
  );
}

export function IctDashboard() {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [projectsRes, ticketsRes, assetsRes, invoicesRes, clientsRes] = await Promise.all([
      supabase.from("service_projects" as any)
        .select("id,title,status,stage,due_date,created_at,clients(company_name),service_milestones(id,title,due_date,done)")
        .eq("module", "ict").order("created_at", { ascending: false }),
      supabase.from("ict_tickets").select("id,ticket_number,title,priority,status,created_at").order("created_at", { ascending: false }),
      supabase.from("ict_assets").select("id", { count: "exact", head: true }),
      supabase.from("invoices").select("id,status,total,amount_paid,service_line").eq("service_line", "ict"),
      supabase.from("clients").select("id", { count: "exact", head: true }),
    ]);
    if (projectsRes.error) toast.error(`ICT projects: ${projectsRes.error.message}`);
    if (ticketsRes.error) toast.error(`ICT tickets: ${ticketsRes.error.message}`);
    if (invoicesRes.error) toast.error(`ICT invoices: ${invoicesRes.error.message}`);
    const projects = (projectsRes.data ?? []) as unknown as Project[];
    const tickets = (ticketsRes.data ?? []) as TicketRow[];
    const invoices = (invoicesRes.data ?? []) as any[];
    const openProjects = projects.filter((p) => p.status !== "completed" && p.status !== "cancelled").length;
    const overdueMilestones = projects.reduce((sum, p) => sum + (p.service_milestones ?? []).filter((m) => !!m.due_date && m.due_date < today() && !m.done).length, 0);
    const activeTickets = tickets.filter((t) => !["Resolved", "Closed"].includes(t.status));
    const invoiceBalance = invoices.reduce((sum, inv) => sum + Math.max(0, (Number(inv.total ?? 0) - Number(inv.amount_paid ?? 0))), 0);
    setData({
      projects, tickets: tickets.slice(0, 6), projectCount: projects.length, openProjects,
      overdueMilestones, ticketCount: activeTickets.length,
      criticalTickets: activeTickets.filter((t) => t.priority?.toLowerCase() === "critical").length,
      assetsCount: assetsRes.count ?? 0, invoiceOutstanding: invoices.filter((inv) => Number(inv.total ?? 0) > Number(inv.amount_paid ?? 0)).length,
      invoiceBalance, clientsCount: clientsRes.count ?? 0,
    });
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const atRiskProjects = useMemo(() => data.projects.filter((p) => {
    if (p.status === "completed" || p.status === "cancelled") return false;
    const overdue = !!p.due_date && p.due_date < today();
    const lateMilestone = (p.service_milestones ?? []).some((m) => !!m.due_date && m.due_date < today() && !m.done);
    return overdue || lateMilestone;
  }).slice(0, 5), [data.projects]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /><h2 className="text-xl font-semibold">ICT command centre</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">A live overview of ICT delivery, support workload, assets and receivables.</p>
          {lastUpdated && <p className="mt-1 text-xs text-muted-foreground">Updated {lastUpdated.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</p>}
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Active projects" value={loading ? "—" : data.openProjects} detail={`${data.projectCount} total ICT projects`} icon={BriefcaseBusiness} href="/ict" />
        <Metric label="Open support tickets" value={loading ? "—" : data.ticketCount} detail={`${data.criticalTickets} critical tickets`} icon={Ticket} href="/ict-service-desk" tone={data.criticalTickets ? "danger" : "default"} />
        <Metric label="Overdue milestones" value={loading ? "—" : data.overdueMilestones} detail="Incomplete steps past their due date" icon={CalendarClock} href="/ict" tone={data.overdueMilestones ? "warning" : "success"} />
        <Metric label="Projects at risk" value={loading ? "—" : atRiskProjects.length} detail="Overdue project or milestone dates" icon={AlertTriangle} href="/ict" tone={atRiskProjects.length ? "warning" : "success"} />
        <Metric label="ICT assets" value={loading ? "—" : data.assetsCount} detail="Assets visible to your account" icon={HardDrive} href="/ict-service-desk" />
        <Metric label="Clients" value={loading ? "—" : data.clientsCount} detail="Clients in the shared directory" icon={Users} href="/ict" />
        <Metric label="Outstanding invoices" value={loading ? "—" : data.invoiceOutstanding} detail="ICT invoices with a balance due" icon={ClipboardList} href="/ict" tone={data.invoiceOutstanding ? "warning" : "success"} />
        <Metric label="Outstanding value" value={loading ? "—" : money(data.invoiceBalance)} detail="Estimated total ICT balance due" icon={CircleDollarSign} href="/ict" tone={data.invoiceBalance ? "warning" : "success"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b p-4">
            <div><h3 className="font-semibold">Projects needing attention</h3><p className="mt-0.5 text-xs text-muted-foreground">Projects with overdue dates or incomplete late milestones</p></div>
            <Link to="/ict" className="text-sm font-medium text-primary hover:underline">All projects</Link>
          </div>
          {atRiskProjects.length ? <div className="divide-y">{atRiskProjects.map((p) => {
            const late = (p.service_milestones ?? []).filter((m) => !!m.due_date && m.due_date < today() && !m.done).length;
            return <div key={p.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{p.title}</p><p className="mt-1 text-xs text-muted-foreground">{p.clients?.company_name ?? "No client linked"} · {p.stage?.replaceAll("_", " ") ?? p.status ?? "Unstaged"}</p></div>
              <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">{late ? `${late} late step${late === 1 ? "" : "s"}` : `Due ${dateLabel(p.due_date)}`}</span>
            </div>;
          })}</div> : <div className="p-8 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" /><p className="mt-2 text-sm font-medium">No overdue work detected</p><p className="mt-1 text-xs text-muted-foreground">Projects with late dates will appear here.</p></div>}
        </div>

        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b p-4">
            <div><h3 className="font-semibold">Recent support tickets</h3><p className="mt-0.5 text-xs text-muted-foreground">Latest ICT service desk activity</p></div>
            <Link to="/ict-service-desk" className="text-sm font-medium text-primary hover:underline">Open service desk</Link>
          </div>
          {data.tickets.length ? <div className="divide-y">{data.tickets.map((t) => <div key={t.id} className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{t.title}</p><p className="mt-1 text-xs text-muted-foreground">{t.ticket_number ? `${t.ticket_number} · ` : ""}{dateLabel(t.created_at)}</p></div>
            <div className="flex shrink-0 flex-col items-end gap-1"><span className={`rounded-full px-2 py-0.5 text-xs ${t.priority?.toLowerCase() === "critical" ? "bg-destructive/10 text-destructive" : t.priority?.toLowerCase() === "high" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}>{t.priority ?? "Normal"}</span><span className="text-xs text-muted-foreground">{t.status}</span></div>
          </div>)}</div> : <div className="p-8 text-center"><Ticket className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-2 text-sm font-medium">No tickets to display</p><p className="mt-1 text-xs text-muted-foreground">Tickets visible to your account will appear here.</p></div>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-4">
        <div className="flex items-start gap-3"><TrendingUp className="mt-0.5 h-5 w-5 text-primary" /><div><p className="text-sm font-medium">Keep ICT delivery moving</p><p className="mt-1 text-xs text-muted-foreground">Review project milestones, clear critical tickets, and follow up outstanding invoices.</p></div></div>
        <div className="flex flex-wrap gap-2"><Link to="/ict" className="rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted">Manage projects</Link><Link to="/ict-service-desk" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90">Go to service desk</Link></div>
      </div>
    </section>
  );
}
