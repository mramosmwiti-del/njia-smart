import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Ticket, HardDrive, Wrench, AlertTriangle, Plus, X } from "lucide-react";

export const Route = createFileRoute("/_authed/ict-service-desk")({
  head: () => ({
    meta: [
      { title: "ICT Service Desk | G.K Nahashon & Company" },
      { name: "description", content: "Internal IT support, assets and maintenance." },
    ],
  }),
  component: IctServiceDesk,
});

const CATEGORIES = ["Hardware", "Software", "Network", "Access/Account", "Other"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const EMPTY_FORM = { title: "", description: "", category: CATEGORIES[0], priority: "Medium" };

const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-muted text-muted-foreground",
  Medium: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  High: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  Critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

type Ticket = {
  id: string;
  ticket_number: string | null;
  title: string;
  description: string | null;
  category: string | null;
  priority: string | null;
  status: string;
  reported_by: string;
  assigned_to: string | null;
  created_at: string;
};

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="bg-card rounded-lg border p-4 h-full">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function IctServiceDesk() {
  const { user, access, canCreate } = useAuth();
  const fullAccess = access("ict_service_desk") === "full";
  const canRaiseTicket = canCreate("ict_service_desk");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // RLS already scopes this correctly: regular staff only see tickets they
  // reported, full-access roles (Director/Admin) see every ticket — so a
  // plain select gives each viewer exactly the counts/rows they should see.
  async function load() {
    setLoading(true);
    const [ticketsRes, openRes, criticalRes] = await Promise.all([
      supabase.from("ict_tickets").select("*").order("created_at", { ascending: false }),
      supabase.from("ict_tickets").select("id", { count: "exact", head: true }).not("status", "in", "(Resolved,Closed)"),
      supabase.from("ict_tickets").select("id", { count: "exact", head: true }).eq("priority", "Critical"),
    ]);
    if (ticketsRes.error) toast.error(ticketsRes.error.message);
    setTickets((ticketsRes.data as Ticket[]) ?? []);
    setOpenCount(openRes.count ?? 0);
    setCriticalCount(criticalRes.count ?? 0);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !user) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("ict_tickets")
      .insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        priority: form.priority,
        reported_by: user.id,
      })
      .select("ticket_number")
      .single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Ticket ${data?.ticket_number ?? ""} raised`.trim());
    setForm(EMPTY_FORM);
    setFormOpen(false);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">ICT Service Desk</h1>
          <p className="text-sm text-muted-foreground">Internal IT support, assets and maintenance.</p>
        </div>
        {canRaiseTicket && (
          <button
            onClick={() => setFormOpen(true)}
            className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Raise a ticket
          </button>
        )}
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Ticket} label="Open Tickets" value={openCount} />
        {fullAccess && <StatCard icon={HardDrive} label="Assets" value={0} />}
        <StatCard icon={Wrench} label="Active Maintenance" value={0} />
        <StatCard icon={AlertTriangle} label="Critical Issues" value={criticalCount} />
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b text-sm font-medium">
          {fullAccess ? "All tickets" : "Your tickets"}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground border-b">
              <tr>
                <th className="py-2 px-3">Ticket</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Raised</th>
              </tr>
            </thead>
            <tbody>
              {!loading && tickets.length === 0 && (
                <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">No tickets yet.</td></tr>
              )}
              {tickets.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 px-3">
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">{t.ticket_number}</div>
                  </td>
                  <td className="text-xs text-muted-foreground">{t.category ?? "—"}</td>
                  <td><span className={`text-xs px-2 py-0.5 rounded ${PRIORITY_COLORS[t.priority ?? ""] ?? "bg-muted text-muted-foreground"}`}>{t.priority ?? "—"}</span></td>
                  <td className="text-xs">{t.status}</td>
                  <td className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setFormOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitTicket} className="bg-card w-full max-w-md rounded-lg p-6 space-y-3">
            <div className="flex justify-between">
              <h2 className="text-lg font-semibold">Raise a ticket</h2>
              <button type="button" onClick={() => setFormOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <input
              required
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full h-9 px-3 rounded-md border bg-background text-sm"
            />
            <textarea
              placeholder="Describe the issue"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-9 px-3 rounded-md border bg-background text-sm">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-9 px-3 rounded-md border bg-background text-sm">
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <button disabled={saving} className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
              {saving ? "Submitting…" : "Submit ticket"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

