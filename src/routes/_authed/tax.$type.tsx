import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Save, X } from "lucide-react";
import { formatDate, daysUntil, STATUS_COLORS } from "@/lib/format";
import { TaxAssignees } from "@/components/tax-assignees";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authed/tax/$type")({ component: TaxTypePage });

const TYPE_LABELS: Record<string, string> = {
  vat: "VAT", paye: "PAYE", wht: "Withholding Tax", rental: "Rental Income",
  tot: "Turnover Tax", corp_tax: "Corporation Tax", nil: "Nil Return",
  mri: "MRI", nssf: "NSSF", sha: "SHA",
  etims: "eTIMS", income_tax: "Income Tax", nita: "NITA", excise_duty: "Excise Duty",
};
const TYPE_CADENCE: Record<string, "monthly" | "annual"> = {
  vat: "monthly", paye: "monthly", wht: "monthly", rental: "monthly",
  tot: "monthly", nil: "monthly", corp_tax: "annual",
  mri: "monthly", nssf: "monthly", sha: "monthly",
  etims: "monthly", income_tax: "annual", nita: "monthly", excise_duty: "monthly",
};
const STATUSES = ["pending","in_progress","filed","overdue"];

// Smart overdue: counts whole filing periods missed past the due date,
// not raw days. A return is only "overdue" once at least one full period
// (month or year, depending on tax type) has elapsed since the due date.
function periodsOverdue(dueDate: string | null | undefined, cadence: "monthly" | "annual"): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return 0;
  const now = new Date();
  if (now <= due) return 0;
  if (cadence === "annual") {
    let yrs = now.getFullYear() - due.getFullYear();
    const md = now.getMonth() - due.getMonth();
    const dd = now.getDate() - due.getDate();
    if (md < 0 || (md === 0 && dd < 0)) yrs -= 1;
    return Math.max(0, yrs);
  }
  let months = (now.getFullYear() - due.getFullYear()) * 12 + (now.getMonth() - due.getMonth());
  if (now.getDate() < due.getDate()) months -= 1;
  return Math.max(0, months);
}

function TaxTypePage() {
  const { type } = useParams({ from: "/_authed/tax/$type" });
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [filter, setFilter] = useState({ client: "", assignee: "", status: "" });
  const [editing, setEditing] = useState<any>(null);

  async function load() {
    const [t, c, p] = await Promise.all([
      supabase.from("tax_returns").select("*, clients(company_name)").eq("return_type", type as any).order("due_date"),
      supabase.from("clients").select("id, company_name").order("company_name"),
      supabase.from("profiles").select("id, full_name"),
    ]);
    const byId = new Map((p.data ?? []).map((x: any) => [x.id, x]));
    setRows((t.data ?? []).map((r: any) => ({ ...r, assignee: r.assigned_to ? byId.get(r.assigned_to) ?? null : null })));
    setClients(c.data ?? []);
    setStaff(p.data ?? []);
  }
  useEffect(() => { load(); }, [type]);

  const filtered = useMemo(() => rows.filter(r =>
    (!filter.client || r.client_id === filter.client) &&
    (!filter.assignee || r.assigned_to === filter.assignee) &&
    (!filter.status || r.status === filter.status)
  ), [rows, filter]);

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("tax_returns").update({ status: status as any }).eq("id", id);
    if (error) toast.error(error.message); else load();
  }
  async function remove(id: string) {
    if (!confirm("Remove this tax return?")) return;
    const { error } = await supabase.from("tax_returns").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  }
  async function saveEdit() {
    const { id, clients: _c, assignee: _a, ...payload } = editing;
    const { error } = await supabase.from("tax_returns").update(payload).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Saved"); setEditing(null); load(); }
  }

  const label = TYPE_LABELS[type] ?? type.toUpperCase();
  const cadence = TYPE_CADENCE[type] ?? "monthly";
  const periodWord = cadence === "annual" ? "yr" : "mo";
  const summary = {
    total: rows.length,
    pending: rows.filter(r => r.status === "pending").length,
    inProgress: rows.filter(r => r.status === "in_progress").length,
    filed: rows.filter(r => r.status === "filed").length,
    overdue: rows.filter(r => r.status !== "filed" && periodsOverdue(r.due_date, cadence) >= 1).length,
  };

  return (
    <div className="space-y-4">
      <Link to="/tax" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Back to tax</Link>

      <div>
        <h1 className="text-2xl font-bold">{label} returns</h1>
        <p className="text-sm text-muted-foreground">All clients and filings under this tax category.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", val: summary.total },
          { label: "Pending", val: summary.pending },
          { label: "In progress", val: summary.inProgress },
          { label: "Filed", val: summary.filed },
          { label: "Overdue", val: summary.overdue, tone: "text-destructive" },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-lg p-3">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className={`text-2xl font-bold ${s.tone ?? ""}`}>{s.val}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-lg p-3 flex flex-wrap gap-2 items-center">
        <span className="text-xs font-medium text-muted-foreground">Filter:</span>
        <select value={filter.client} onChange={e => setFilter({ ...filter, client: e.target.value })} className="h-8 px-2 rounded-md border bg-background text-xs">
          <option value="">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
        <select value={filter.assignee} onChange={e => setFilter({ ...filter, assignee: e.target.value })} className="h-8 px-2 rounded-md border bg-background text-xs">
          <option value="">All assignees</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })} className="h-8 px-2 rounded-md border bg-background text-xs">
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        {(filter.client || filter.assignee || filter.status) && (
          <button onClick={() => setFilter({ client: "", assignee: "", status: "" })} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
        )}
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b bg-muted/40">
              <tr><th className="py-2 px-3">Client</th><th>Period</th><th>Due</th><th>Status</th><th>Assignee</th><th>Team</th><th>Notes</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-muted-foreground">No returns match your filters.</td></tr>}
              {filtered.map(r => {
                const d = daysUntil(r.due_date);
                const over = periodsOverdue(r.due_date, cadence);
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{r.clients?.company_name}</td>
                    <td>{formatDate(r.period_end)}</td>
                    <td>
                      {formatDate(r.due_date)}
                      {over >= 1 && r.status !== "filed" && <span className="ml-2 text-xs text-destructive">{over} {periodWord}{over > 1 ? "s" : ""} overdue</span>}
                      {over < 1 && d !== null && d >= 0 && d <= 3 && r.status !== "filed" && <span className="ml-2 text-xs text-accent">in {d}d</span>}
                    </td>
                    <td>
                      <select value={r.status} onChange={e => setStatus(r.id, e.target.value)} className={`h-7 px-2 rounded text-xs border bg-background capitalize ${STATUS_COLORS[r.status]}`}>
                        {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                      </select>
                    </td>
                    <td className="text-xs">{r.assignee?.full_name ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-2 px-3 relative"><TaxAssignees taxReturnId={r.id} compact /></td>
                    <td className="text-xs text-muted-foreground max-w-[200px] truncate" title={r.notes || ""}>{r.notes || "—"}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button onClick={() => setEditing(r)} className="text-xs text-primary mr-2">Edit</button>
                      {isAdmin && (
                        <button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive" title="Remove">
                          <Trash2 className="h-3.5 w-3.5 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-card w-full max-w-md rounded-lg p-6 space-y-3">
            <div className="flex justify-between"><h2 className="text-lg font-semibold">Edit return</h2><button onClick={() => setEditing(null)}><X className="h-4 w-4" /></button></div>
            <div>
              <label className="text-xs font-medium">Status</label>
              <select value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm capitalize">
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Assignee</label>
              <select value={editing.assigned_to ?? ""} onChange={e => setEditing({ ...editing, assigned_to: e.target.value || null })} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm">
                <option value="">— Unassigned —</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs font-medium">Period start</label><input type="date" value={editing.period_start ?? ""} onChange={e => setEditing({ ...editing, period_start: e.target.value || null })} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm" /></div>
              <div><label className="text-xs font-medium">Period end</label><input type="date" value={editing.period_end ?? ""} onChange={e => setEditing({ ...editing, period_end: e.target.value || null })} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm" /></div>
            </div>
            <div><label className="text-xs font-medium">Due date</label><input type="date" value={editing.due_date ?? ""} onChange={e => setEditing({ ...editing, due_date: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm" /></div>
            <div><label className="text-xs font-medium">Notes</label><textarea value={editing.notes ?? ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} rows={3} className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm" /></div>
            <button onClick={saveEdit} className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium inline-flex items-center justify-center gap-2"><Save className="h-4 w-4" /> Save</button>
          </div>
        </div>
      )}
    </div>
  );
}
