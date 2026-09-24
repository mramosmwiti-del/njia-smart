import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authed/tax")({
  head: () => ({
    meta: [
      { title: "Tax | G.K Nahashon & Company" },
      { name: "description", content: "Policy-driven tax filing: obligation checklist, filing progress and per-type policies." },
    ],
  }),
  component: TaxPage,
});

const TABS = ["Overview", "Checklist", "Policies"] as const;
const CADENCES = ["monthly", "quarterly", "annual"] as const;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function TaxPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [policies, setPolicies] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyCell, setBusyCell] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState("");
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<any>({});
  const [addingPolicy, setAddingPolicy] = useState(false);
  const [newPolicy, setNewPolicy] = useState<any>({ tax_type: "", label: "", cadence: "monthly", due_day: 20 });

  async function load() {
    setLoading(true);
    const [p, r, c, o] = await Promise.all([
      supabase.from("tax_policies").select("*").order("sort_order"),
      supabase.from("tax_returns").select("client_id, return_type, status, due_date"),
      supabase.from("clients").select("id, company_name").order("company_name"),
      supabase.from("client_tax_obligations").select("*"),
    ]);
    setPolicies((p.data as any[]) ?? []);
    setReturns(r.data ?? []);
    setClients(c.data ?? []);
    setObligations((o.data as any[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const activePolicies = useMemo(() => policies.filter(p => p.active), [policies]);

  const summary = useMemo(() => {
    const today = todayISO();
    return activePolicies.map(pol => {
      const rows = returns.filter(r => r.return_type === pol.tax_type);
      const open = rows.filter(r => r.status !== "filed");
      const overdue = open.filter(r => r.due_date && r.due_date < today).length;
      const filed = rows.length - open.length;
      const obligated = obligations.filter(o => o.tax_type === pol.tax_type && o.active).length;
      return { ...pol, open: open.length, overdue, filed, obligated };
    });
  }, [activePolicies, returns, obligations]);

  const obligationMap = useMemo(() => {
    const m = new Map<string, boolean>();
    obligations.forEach(o => m.set(`${o.client_id}:${o.tax_type}`, o.active));
    return m;
  }, [obligations]);

  const filteredClients = useMemo(
    () => clients.filter(c => !clientFilter || c.company_name?.toLowerCase().includes(clientFilter.toLowerCase())),
    [clients, clientFilter]
  );

  async function toggleObligation(clientId: string, taxType: string, next: boolean) {
    const key = `${clientId}:${taxType}`;
    setBusyCell(key);
    const { error } = await supabase.rpc("set_client_tax_obligation", {
      _client_id: clientId, _tax_type: taxType, _active: next,
    });
    setBusyCell(null);
    if (error) toast.error(error.message);
    else load();
  }

  function startEdit(p: any) {
    setEditingType(p.tax_type);
    setEditRow({ label: p.label, cadence: p.cadence, due_day: p.due_day, active: p.active });
  }
  async function saveEdit(taxType: string) {
    const { error } = await supabase.from("tax_policies").update({
      label: editRow.label, cadence: editRow.cadence, due_day: Number(editRow.due_day) || 20, active: !!editRow.active,
    }).eq("tax_type", taxType);
    if (error) toast.error(error.message);
    else { toast.success("Policy saved"); setEditingType(null); load(); }
  }

  async function addPolicy() {
    const key = newPolicy.tax_type.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key || !newPolicy.label.trim()) { toast.error("Type key and label are required"); return; }
    const { error } = await supabase.from("tax_policies").insert({
      tax_type: key, label: newPolicy.label.trim(), cadence: newPolicy.cadence,
      due_day: Number(newPolicy.due_day) || 20, sort_order: policies.length + 1,
    } as any);
    if (error) toast.error(error.message);
    else {
      toast.success("Tax type added");
      setAddingPolicy(false);
      setNewPolicy({ tax_type: "", label: "", cadence: "monthly", due_day: 20 });
      load();
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Tax</h1>
        <p className="text-sm text-muted-foreground">Each tax type follows its own policy — file the current period and the next one is scheduled automatically.</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm border-b-2 transition-colors ${tab === t ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t}</button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && tab === "Overview" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {summary.length === 0 && (
            <div className="col-span-full bg-card border rounded-lg p-8 text-center text-muted-foreground text-sm">
              No active tax policies yet — add one under the Policies tab.
            </div>
          )}
          {summary.map(s => (
            <Link key={s.tax_type} to="/tax/$type" params={{ type: s.tax_type }} className="text-left bg-card border rounded-lg p-3 hover:border-primary/60 hover:shadow-sm transition block">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{s.label}</div>
                <div className="text-[11px] text-muted-foreground capitalize whitespace-nowrap">{s.cadence} · due {s.due_day}</div>
              </div>
              <div className="text-2xl font-bold mt-1">{s.open}</div>
              <div className="text-xs text-muted-foreground">
                open · {s.obligated} client{s.obligated === 1 ? "" : "s"} obligated
                {s.overdue > 0 && <span className="text-destructive"> · {s.overdue} overdue</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && tab === "Checklist" && (
        <div className="space-y-3">
          <input placeholder="Filter clients…" value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="h-9 w-64 px-3 rounded-md border bg-background text-sm" />
          <div className="bg-card border rounded-lg overflow-auto">
            <table className="text-sm min-w-full">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground border-b">
                <tr>
                  <th className="py-2 px-3 sticky left-0 bg-muted/40 z-10">Client</th>
                  {activePolicies.map(p => <th key={p.tax_type} className="py-2 px-2 text-center whitespace-nowrap font-medium">{p.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredClients.length === 0 && (
                  <tr><td colSpan={activePolicies.length + 1} className="py-8 text-center text-muted-foreground">No clients match.</td></tr>
                )}
                {filteredClients.map(c => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="py-1.5 px-3 font-medium sticky left-0 bg-card whitespace-nowrap">{c.company_name}</td>
                    {activePolicies.map(p => {
                      const key = `${c.id}:${p.tax_type}`;
                      const checked = obligationMap.get(key) ?? false;
                      return (
                        <td key={p.tax_type} className="py-1.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={busyCell === key}
                            onChange={e => toggleObligation(c.id, p.tax_type, e.target.checked)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Checking a box schedules that client's first open filing. Unchecking stops future auto-renewal — filings already open aren't removed.</p>
        </div>
      )}

      {!loading && tab === "Policies" && (
        <div className="space-y-3">
          {!isAdmin && <p className="text-sm text-muted-foreground">Only admins/directors can edit policies.</p>}
          <div className="bg-card border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground border-b">
                <tr><th className="py-2 px-3">Tax type</th><th className="py-2 px-3">Label</th><th className="py-2 px-3">Cadence</th><th className="py-2 px-3">Due day</th><th className="py-2 px-3">Active</th><th className="py-2 px-3 w-24"></th></tr>
              </thead>
              <tbody>
                {policies.map(p => {
                  const editing = editingType === p.tax_type;
                  return (
                    <tr key={p.tax_type} className="border-b last:border-0">
                      <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{p.tax_type}</td>
                      <td className="py-2 px-3">
                        {editing ? <input value={editRow.label} onChange={e => setEditRow({ ...editRow, label: e.target.value })} className="h-8 px-2 rounded border bg-background text-sm w-40" /> : p.label}
                      </td>
                      <td className="py-2 px-3">
                        {editing ? (
                          <select value={editRow.cadence} onChange={e => setEditRow({ ...editRow, cadence: e.target.value })} className="h-8 px-2 rounded border bg-background text-sm capitalize">
                            {CADENCES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        ) : <span className="capitalize">{p.cadence}</span>}
                      </td>
                      <td className="py-2 px-3">
                        {editing ? <input type="number" min={1} max={31} value={editRow.due_day} onChange={e => setEditRow({ ...editRow, due_day: e.target.value })} className="h-8 w-16 px-2 rounded border bg-background text-sm" /> : p.due_day}
                      </td>
                      <td className="py-2 px-3">
                        {editing ? <input type="checkbox" checked={!!editRow.active} onChange={e => setEditRow({ ...editRow, active: e.target.checked })} /> : (p.active ? "Yes" : "No")}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        {isAdmin && (editing ? (
                          <div className="inline-flex gap-2">
                            <button onClick={() => saveEdit(p.tax_type)} className="text-primary text-xs inline-flex items-center gap-1"><Save className="h-3 w-3" />Save</button>
                            <button onClick={() => setEditingType(null)} className="text-muted-foreground text-xs">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(p)} className="text-primary text-xs">Edit</button>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {isAdmin && (
            addingPolicy ? (
              <div className="bg-card border rounded-lg p-3 grid sm:grid-cols-5 gap-2 items-end">
                <div>
                  <label className="text-xs font-medium">Type key</label>
                  <input placeholder="e.g. digital_service_tax" value={newPolicy.tax_type} onChange={e => setNewPolicy({ ...newPolicy, tax_type: e.target.value })} className="mt-1 w-full h-9 px-2 rounded-md border bg-background text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium">Label</label>
                  <input value={newPolicy.label} onChange={e => setNewPolicy({ ...newPolicy, label: e.target.value })} className="mt-1 w-full h-9 px-2 rounded-md border bg-background text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium">Cadence</label>
                  <select value={newPolicy.cadence} onChange={e => setNewPolicy({ ...newPolicy, cadence: e.target.value })} className="mt-1 w-full h-9 px-2 rounded-md border bg-background text-sm capitalize">
                    {CADENCES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Due day</label>
                  <input type="number" min={1} max={31} value={newPolicy.due_day} onChange={e => setNewPolicy({ ...newPolicy, due_day: e.target.value })} className="mt-1 w-full h-9 px-2 rounded-md border bg-background text-sm" />
                </div>
                <div className="flex gap-2">
                  <button onClick={addPolicy} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm">Add</button>
                  <button onClick={() => setAddingPolicy(false)} className="h-9 px-3 rounded-md border text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingPolicy(true)} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-2"><Plus className="h-4 w-4" /> Add tax type</button>
            )
          )}
        </div>
      )}
    </div>
  );
}
