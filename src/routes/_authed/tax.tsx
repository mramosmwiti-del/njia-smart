import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Plus, AlertTriangle, Clock, UserX, LayoutGrid, Check } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { daysUntil, periodsOverdue } from "@/lib/format";

export const Route = createFileRoute("/_authed/tax")({
  head: () => ({
    meta: [
      { title: "Tax | G.K Nahashon & Company" },
      { name: "description", content: "Policy-driven tax filing: obligation checklist, filing progress and per-type policies." },
    ],
  }),
  component: TaxPage,
});

const TABS = ["Overview", "Checklist", "Filing Record", "Policies"] as const;
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
  const [staff, setStaff] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyCell, setBusyCell] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState("");
  const [accFilter, setAccFilter] = useState<"all" | "overdue" | "duesoon" | "unassigned">("all");
  const [checklistType, setChecklistType] = useState<string>("");
  const [reportType, setReportType] = useState<string>("");
  const [reportFilter, setReportFilter] = useState<"all" | "filed" | "not_filed">("all");
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<any>({});
  const [addingPolicy, setAddingPolicy] = useState(false);
  const [newPolicy, setNewPolicy] = useState<any>({ tax_type: "", label: "", cadence: "monthly", due_day: 20 });

  async function load() {
    setLoading(true);
    const [p, r, c, o, s] = await Promise.all([
      supabase.from("tax_policies").select("*").order("sort_order"),
      supabase.from("tax_returns").select("id, client_id, return_type, status, due_date, assigned_to"),
      supabase.from("clients").select("id, company_name").order("company_name"),
      supabase.from("client_tax_obligations").select("*"),
      supabase.from("profiles").select("id, full_name"),
    ]);
    setPolicies((p.data as any[]) ?? []);
    setReturns(r.data ?? []);
    setClients(c.data ?? []);
    setStaff(s.data ?? []);
    setObligations((o.data as any[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const activePolicies = useMemo(() => policies.filter(p => p.active), [policies]);

  useEffect(() => {
    if (activePolicies.length === 0) return;
    if (!checklistType || !activePolicies.some(p => p.tax_type === checklistType)) {
      setChecklistType(activePolicies[0].tax_type);
    }
  }, [activePolicies]);

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

  const staffMap = useMemo(() => new Map(staff.map((s: any) => [s.id, s.full_name])), [staff]);

  const returnsByKey = useMemo(() => {
    const m = new Map<string, any[]>();
    returns.forEach((r: any) => {
      const k = `${r.client_id}:${r.return_type}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    });
    return m;
  }, [returns]);

  // The row that matters right now for a client+type: the earliest-due open
  // filing if one exists, otherwise the most recent filed one.
  function currentReturn(clientId: string, taxType: string) {
    const list = returnsByKey.get(`${clientId}:${taxType}`) ?? [];
    if (list.length === 0) return null;
    const open = list.filter(r => r.status !== "filed").sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
    if (open.length) return open[0];
    return [...list].sort((a, b) => (b.due_date ?? "").localeCompare(a.due_date ?? ""))[0];
  }

  // Accountability flags computed across ALL clients (not just the text
  // search) so the summary chips always reflect the true picture.
  const accStats = useMemo(() => {
    const overdue = new Set<string>();
    const duesoon = new Set<string>();
    const unassigned = new Set<string>();
    let overdueCells = 0, duesoonCells = 0, unassignedCells = 0;
    clients.forEach(c => {
      activePolicies.forEach(pol => {
        if (!obligationMap.get(`${c.id}:${pol.tax_type}`)) return;
        const cur = currentReturn(c.id, pol.tax_type);
        if (!cur || cur.status === "filed") return;
        const over = periodsOverdue(cur.due_date, pol.cadence);
        const d = daysUntil(cur.due_date);
        if (over >= 1) { overdue.add(c.id); overdueCells++; }
        else if (d !== null && d >= 0 && d <= 7) { duesoon.add(c.id); duesoonCells++; }
        if (!cur.assigned_to) { unassigned.add(c.id); unassignedCells++; }
      });
    });
    return { flagged: { overdue, duesoon, unassigned }, overdueCells, duesoonCells, unassignedCells };
  }, [clients, activePolicies, obligationMap, returnsByKey]);

  const displayClients = useMemo(() => {
    if (accFilter === "all") return filteredClients;
    const set = accStats.flagged[accFilter];
    return filteredClients.filter(c => set.has(c.id));
  }, [filteredClients, accFilter, accStats]);

  // One row per obligated client x type — the same source data as the
  // checklist, just flattened into a filed / not-filed report.
  const reportRows = useMemo(() => {
    const rows: { client: any; pol: any; cur: any; filed: boolean }[] = [];
    const scopedPolicies = reportType ? activePolicies.filter(p => p.tax_type === reportType) : activePolicies;
    filteredClients.forEach(c => {
      scopedPolicies.forEach(pol => {
        if (!obligationMap.get(`${c.id}:${pol.tax_type}`)) return;
        const cur = currentReturn(c.id, pol.tax_type);
        rows.push({ client: c, pol, cur, filed: cur?.status === "filed" });
      });
    });
    return rows;
  }, [filteredClients, activePolicies, reportType, obligationMap, returnsByKey]);

  const filteredReportRows = useMemo(() => {
    if (reportFilter === "all") return reportRows;
    return reportRows.filter(r => (reportFilter === "filed" ? r.filed : !r.filed));
  }, [reportRows, reportFilter]);

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
          <div className="flex flex-wrap gap-2 items-center">
            <div>
              <label className="text-xs font-medium text-muted-foreground mr-2">Tax type</label>
              <select value={checklistType} onChange={e => setChecklistType(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm min-w-[180px]">
                {activePolicies.length === 0 && <option value="">No active policies</option>}
                {activePolicies.map(p => <option key={p.tax_type} value={p.tax_type}>{p.label}</option>)}
              </select>
            </div>
            <input placeholder="Filter clients…" value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="h-9 w-64 px-3 rounded-md border bg-background text-sm" />
            <div className="flex flex-wrap gap-2 ml-auto">
              <ChecklistChip active={accFilter === "all"} onClick={() => setAccFilter("all")} icon={LayoutGrid} label="All clients" value={clients.length} tone="muted" />
              <ChecklistChip active={accFilter === "overdue"} onClick={() => setAccFilter("overdue")} icon={AlertTriangle} label="Overdue" value={accStats.flagged.overdue.size} tone="destructive" />
              <ChecklistChip active={accFilter === "duesoon"} onClick={() => setAccFilter("duesoon")} icon={Clock} label="Due ≤7 days" value={accStats.flagged.duesoon.size} tone="amber" />
              <ChecklistChip active={accFilter === "unassigned"} onClick={() => setAccFilter("unassigned")} icon={UserX} label="Unassigned" value={accStats.flagged.unassigned.size} tone="amber" />
            </div>
          </div>

          {(() => {
            const pol = activePolicies.find(p => p.tax_type === checklistType);
            if (!pol) return <p className="text-sm text-muted-foreground p-4">No active tax policies yet — add one under the Policies tab.</p>;
            return (
              <div className="bg-card border rounded-lg overflow-hidden">
                <div className="px-3 py-2 border-b text-xs text-muted-foreground flex items-center justify-between">
                  <span>Check a client on to add the <span className="font-medium text-foreground">{pol.label}</span> obligation — it schedules that client's first open filing per policy. Uncheck to stop future renewal (open filings stay).</span>
                  <span className="capitalize whitespace-nowrap ml-3">{pol.cadence} · due day {pol.due_day}</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs text-muted-foreground border-b">
                    <tr><th className="py-2 px-3 w-10"></th><th className="py-2 px-3">Client</th><th className="py-2 px-3">Current filing</th></tr>
                  </thead>
                  <tbody>
                    {displayClients.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">No clients match.</td></tr>}
                    {displayClients.map(c => {
                      const key = `${c.id}:${pol.tax_type}`;
                      const obligated = obligationMap.get(key) ?? false;
                      const cur = obligated ? currentReturn(c.id, pol.tax_type) : null;
                      return (
                        <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-1.5 px-3">
                            <input
                              type="checkbox"
                              checked={obligated}
                              disabled={busyCell === key || !isAdmin}
                              title={isAdmin ? undefined : "Only admins/directors can change obligations"}
                              onChange={e => toggleObligation(c.id, pol.tax_type, e.target.checked)}
                            />
                          </td>
                          <td className="py-1.5 px-3 font-medium">{c.company_name}</td>
                          <td className="py-1.5 px-3">
                            {!obligated ? (
                              <span className="text-muted-foreground/50 text-xs">Not obligated</span>
                            ) : !cur ? (
                              <span className="text-xs text-muted-foreground">Scheduling…</span>
                            ) : (
                              <Link to="/tax/$type" params={{ type: pol.tax_type }} search={{ client: c.id }} className="inline-block hover:opacity-80">
                                <ChecklistCell row={cur} cadence={pol.cadence} assigneeName={cur.assigned_to ? staffMap.get(cur.assigned_to) : null} />
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {!loading && tab === "Filing Record" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div>
              <label className="text-xs font-medium text-muted-foreground mr-2">Tax type</label>
              <select value={reportType} onChange={e => setReportType(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm min-w-[180px]">
                <option value="">All types</option>
                {activePolicies.map(p => <option key={p.tax_type} value={p.tax_type}>{p.label}</option>)}
              </select>
            </div>
            <input placeholder="Filter clients…" value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="h-9 w-64 px-3 rounded-md border bg-background text-sm" />
            <div className="flex flex-wrap gap-2 ml-auto">
              <ChecklistChip active={reportFilter === "all"} onClick={() => setReportFilter("all")} icon={LayoutGrid} label="All" value={reportRows.length} tone="muted" />
              <ChecklistChip active={reportFilter === "filed"} onClick={() => setReportFilter("filed")} icon={Check} label="Filed" value={reportRows.filter(r => r.filed).length} tone="muted" />
              <ChecklistChip active={reportFilter === "not_filed"} onClick={() => setReportFilter("not_filed")} icon={AlertTriangle} label="Not filed" value={reportRows.filter(r => !r.filed).length} tone="destructive" />
            </div>
          </div>

          <div className="bg-card border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground border-b">
                <tr><th className="py-2 px-3">Client</th><th className="py-2 px-3">Tax type</th><th className="py-2 px-3">Status</th><th className="py-2 px-3">Due date</th><th className="py-2 px-3">Filed on</th></tr>
              </thead>
              <tbody>
                {filteredReportRows.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No obligations match this view.</td></tr>}
                {filteredReportRows.map(row => (
                  <tr key={`${row.client.id}:${row.pol.tax_type}`} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="py-1.5 px-3 font-medium">{row.client.company_name}</td>
                    <td className="py-1.5 px-3 text-xs text-muted-foreground">{row.pol.label}</td>
                    <td className="py-1.5 px-3">
                      {row.filed ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"><Check className="h-3 w-3" /> Filed</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-100">Not filed</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-xs">{row.cur?.due_date ?? "—"}</td>
                    <td className="py-1.5 px-3 text-xs text-muted-foreground">{row.cur?.filed_at ? new Date(row.cur.filed_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Feeds straight from the checklist — every obligated client's current filing period, marked filed or not filed. Filter by type or search a client above.</p>
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

function ChecklistChip({ active, onClick, icon: Icon, label, value, tone }: {
  active: boolean; onClick: () => void; icon: any; label: string; value: number; tone: "muted" | "destructive" | "amber";
}) {
  const toneClasses = tone === "destructive"
    ? (active ? "bg-destructive text-destructive-foreground border-destructive" : "border-destructive/30 text-destructive hover:bg-destructive/10")
    : tone === "amber"
    ? (active ? "bg-amber-500 text-white border-amber-500" : "border-amber-400/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10")
    : (active ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/30 text-muted-foreground hover:bg-muted");
  return (
    <button onClick={onClick} className={`h-8 px-2.5 rounded-full border text-xs inline-flex items-center gap-1.5 transition-colors ${toneClasses}`}>
      <Icon className="h-3.5 w-3.5" /> {label} <span className="font-semibold">{value}</span>
    </button>
  );
}

function ChecklistCell({ row, cadence, assigneeName }: { row: any; cadence: string; assigneeName?: string | null }) {
  const over = periodsOverdue(row.due_date, cadence);
  const d = daysUntil(row.due_date);
  const filed = row.status === "filed";
  const statusClass = filed
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
    : over >= 1
    ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
    : row.status === "in_progress"
    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
    : "bg-muted text-muted-foreground";
  const initials = assigneeName ? assigneeName.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase() : null;

  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <span className={`text-[11px] px-2 py-0.5 rounded-full capitalize ${statusClass}`}>
        {filed ? "Filed" : row.status.replace(/_/g, " ")}
      </span>
      {!filed && (
        <span className={`text-[10px] ${over >= 1 ? "text-destructive font-medium" : d !== null && d <= 7 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
          {over >= 1 ? `${over}× overdue` : d !== null ? (d < 0 ? "overdue" : d === 0 ? "due today" : `due in ${d}d`) : "no due date"}
        </span>
      )}
      {!filed && (
        initials ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground" title={assigneeName ?? undefined}>{initials}</span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-100 inline-flex items-center gap-0.5">
            <UserX className="h-2.5 w-2.5" /> Unassigned
          </span>
        )
      )}
    </div>
  );
}
