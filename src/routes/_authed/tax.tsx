import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X, Trash2 } from "lucide-react";
import { formatDate, daysUntil, STATUS_COLORS } from "@/lib/format";
import { CsvImport } from "@/components/csv-import";
import { ClientAssignments } from "@/components/client-assignments";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authed/tax")({ component: TaxPage });

const RETURN_TYPES = [
  { v:"vat", label:"VAT", due:20 },
  { v:"paye", label:"PAYE", due:9 },
  { v:"wht", label:"Withholding Tax", due:20 },
  { v:"rental", label:"Rental Income", due:20 },
  { v:"tot", label:"Turnover Tax", due:20 },
  { v:"corp_tax", label:"Corporation Tax", due:30 },
  { v:"nil", label:"Nil Return", due:30 },
  { v:"mri", label:"MRI", due:20 },
  { v:"nssf", label:"NSSF", due:9 },
  { v:"sha", label:"SHA", due:9 },
];

function nextDueDate(type: string) {
  const t = RETURN_TYPES.find(r=>r.v===type)!;
  const now = new Date();
  let d = new Date(now.getFullYear(), now.getMonth(), t.due);
  if (d < now) d = new Date(now.getFullYear(), now.getMonth()+1, t.due);
  return d.toISOString().slice(0,10);
}

function TaxPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ client_id:"", return_type:"vat", due_date:nextDueDate("vat"), period_end:"" });

  async function load() {
    const [t, c] = await Promise.all([
      supabase.from("tax_returns").select("*, clients(company_name)").order("due_date"),
      supabase.from("clients").select("id, company_name").order("company_name"),
    ]);
    setRows(t.data ?? []); setClients(c.data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("tax_returns").insert(form as any);
    if (error) toast.error(error.message);
    else { toast.success("Return scheduled"); setOpen(false); load(); }
  }
  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("tax_returns").update({ status: status as any }).eq("id", id);
    if (error) toast.error(error.message); else load();
  }
  async function remove(id: string) {
    if (!confirm("Remove this tax return?")) return;
    const { error } = await supabase.from("tax_returns").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  }

  const displayRows = useMemo(() => {
    if (!selectedType) return rows;
    return rows.filter(r => r.return_type === selectedType);
  }, [rows, selectedType]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tax</h1>
          <p className="text-sm text-muted-foreground">Kenyan tax returns — VAT 20th · PAYE 9th · WHT 20th · TOT 20th · Rental 20th.</p>
        </div>
        <div className="flex gap-2">
          <CsvImport
            table="tax_returns"
            resolveClientByName
            fields={[
              { key:"client_id", label:"Client (ID or name)", required:true },
              { key:"return_type", label:"Return type (vat/paye/wht/...)", required:true },
              { key:"due_date", label:"Due date", required:true, type:"date" },
              { key:"period_start", label:"Period start", type:"date" },
              { key:"period_end", label:"Period end", type:"date" },
              { key:"status", label:"Status" },
              { key:"notes", label:"Notes" },
            ]}
            onDone={load}
          />
          <button onClick={()=>setOpen(true)} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-2"><Plus className="h-4 w-4" /> Schedule return</button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {RETURN_TYPES.map(rt => {
          const count = rows.filter(r=>r.return_type===rt.v && r.status!=="filed").length;
          const active = selectedType === rt.v;
          return (
            <button
              key={rt.v}
              onClick={() => setSelectedType(active ? "" : rt.v)}
              className={`text-left bg-card border rounded-lg p-3 hover:border-primary/60 hover:shadow-sm transition group ${active ? "ring-2 ring-primary border-primary" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{rt.label}</div>
                <div className={`text-xs ${active ? "text-primary font-medium" : "text-muted-foreground"}`}>{active ? "Showing" : "Filter"}</div>
              </div>
              <div className="text-2xl font-bold mt-1">{count}</div>
              <div className="text-xs text-muted-foreground">pending · due {rt.due}th</div>
            </button>
          );
        })}
      </div>

      {selectedType && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filtered by:</span>
          <span className="font-medium capitalize">{selectedType.replace(/_/g, " ")}</span>
          <button onClick={() => setSelectedType("")} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><X className="h-3 w-3" /> Clear</button>
        </div>
      )}

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b bg-muted/40">
              <tr><th className="py-2 px-3">Client</th><th>Return</th><th>Period</th><th>Due</th><th>Status</th><th>Assigned</th><th></th></tr>
            </thead>
            <tbody>
              {displayRows.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">No returns match your filters.</td></tr>}
              {displayRows.map(r => {
                const d = daysUntil(r.due_date);
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{r.clients?.company_name}</td>
                    <td className="uppercase text-xs">{r.return_type}</td>
                    <td>{formatDate(r.period_end)}</td>
                    <td>
                      {formatDate(r.due_date)}
                      {d !== null && d < 0 && r.status !== "filed" && <span className="ml-2 text-xs text-destructive">{Math.abs(d)}d overdue</span>}
                      {d !== null && d >= 0 && d <= 3 && r.status !== "filed" && <span className="ml-2 text-xs text-accent">in {d}d</span>}
                    </td>
                    <td>
                      <select value={r.status} onChange={e=>setStatus(r.id, e.target.value)} className={`h-7 px-2 rounded text-xs border bg-background capitalize ${STATUS_COLORS[r.status]}`}>
                        {["pending","in_progress","filed","overdue"].map(s=><option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
                      </select>
                    </td>
                    <td className="py-2 px-3">{r.client_id && <ClientAssignments clientId={r.client_id} compact />}</td>
                    <td className="py-2 px-3 text-right">
                      {isAdmin && (
                        <button onClick={()=>remove(r.id)} className="text-muted-foreground hover:text-destructive" title="Remove return">
                          <Trash2 className="h-3.5 w-3.5" />
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

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={()=>setOpen(false)}>
          <form onClick={e=>e.stopPropagation()} onSubmit={save} className="bg-card w-full max-w-md rounded-lg p-6 space-y-3">
            <div className="flex justify-between"><h2 className="text-lg font-semibold">Schedule tax return</h2><button type="button" onClick={()=>setOpen(false)}><X className="h-4 w-4" /></button></div>
            <div>
              <label className="text-xs font-medium">Client *</label>
              <select required value={form.client_id} onChange={e=>setForm({...form, client_id:e.target.value})} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm">
                <option value="">Select…</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Return type *</label>
              <select value={form.return_type} onChange={e=>setForm({...form, return_type:e.target.value, due_date: nextDueDate(e.target.value)})} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm">
                {RETURN_TYPES.map(r=><option key={r.v} value={r.v}>{r.label}</option>)}
              </select>
            </div>
            <div><label className="text-xs font-medium">Period end</label><input type="date" value={form.period_end} onChange={e=>setForm({...form, period_end:e.target.value})} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm" /></div>
            <div><label className="text-xs font-medium">Due date *</label><input required type="date" value={form.due_date} onChange={e=>setForm({...form, due_date:e.target.value})} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm" /></div>
            <button className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium">Schedule</button>
          </form>
        </div>
      )}
    </div>
  );
}
