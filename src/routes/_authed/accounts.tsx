import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X, Trash2, FileText, Wallet, AlertCircle, TrendingUp, Paperclip, Receipt } from "lucide-react";
import { formatDate, STATUS_COLORS } from "@/lib/format";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authed/accounts")({ component: AccountsPage });

const STATUS = ["draft", "sent", "partial", "paid", "overdue"];
const SERVICE_LINES = [
  "Audit", "Tax", "Advisory", "Accounting", "Bookkeeping",
  "Outsourced Accounting", "Payroll Management", "Financial Business Management", "ICT",
  "Other",
];
const METHODS = ["mpesa", "bank", "cash", "cheque", "card"];

async function openReceipt(path: string) {
  const { data, error } = await supabase.storage.from("payment-receipts").createSignedUrl(path, 300);
  if (error) return toast.error(error.message);
  window.open(data.signedUrl, "_blank");
}

function money(n: number) {
  return "KES " + Number(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function AccountsPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const [form, setForm] = useState<any>({ client_id: "", issue_date: today, due_date: in30, service_line: "Audit", vat_rate: 16, notes: "", initial_amount: 0, initial_description: "Professional services" });

  // Standalone payments
  const [payments, setPayments] = useState<any[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState<any>({ client_id: "", invoice_id: "", amount: 0, payment_date: today, method: "mpesa", reference: "", notes: "" });
  const [payFile, setPayFile] = useState<File | null>(null);
  const [savingPay, setSavingPay] = useState(false);

  async function load() {
    const [i, c, p] = await Promise.all([
      supabase.from("invoices").select("*, clients(company_name)").order("issue_date", { ascending: false }),
      supabase.from("clients").select("id, company_name").order("company_name"),
      supabase.from("payments").select("*, clients(company_name), invoices(invoice_number)").order("payment_date", { ascending: false }).limit(50),
    ]);
    if (i.error) toast.error(i.error.message);
    setRows(i.data ?? []);
    setClients(c.data ?? []);
    setPayments(p.data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!form.client_id) return toast.error("Select a client");
    const { data: numRes, error: numErr } = await supabase.rpc("next_invoice_number");
    if (numErr) return toast.error(numErr.message);
    const { data: { user } } = await supabase.auth.getUser();
    const { initial_amount, initial_description, ...invForm } = form;
    const { data, error } = await supabase.from("invoices")
      .insert({ ...invForm, invoice_number: numRes, created_by: user?.id })
      .select().single();
    if (error) return toast.error(error.message);
    if (Number(initial_amount) > 0) {
      await supabase.from("invoice_items").insert({
        invoice_id: data.id,
        description: initial_description || "Professional services",
        quantity: 1,
        unit_price: Number(initial_amount),
        amount: Number(initial_amount),
        sort_order: 0,
      });
    }
    toast.success("Invoice created");
    setOpen(false);
    window.location.href = `/accounts/${data.id}`;
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!pay.client_id) return toast.error("Select a client");
    if (!pay.amount) return toast.error("Enter amount");
    setSavingPay(true);
    const { data: { user } } = await supabase.auth.getUser();
    let receipt_url: string | null = null;
    let receipt_path: string | null = null;
    if (payFile) {
      const ext = payFile.name.split(".").pop() || "bin";
      const path = `${pay.client_id}/standalone/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("payment-receipts").upload(path, payFile);
      if (up.error) { setSavingPay(false); return toast.error(up.error.message); }
      receipt_path = path;
      receipt_url = supabase.storage.from("payment-receipts").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("payments").insert({
      client_id: pay.client_id,
      invoice_id: pay.invoice_id || null,
      amount: Number(pay.amount),
      payment_date: pay.payment_date,
      method: pay.method,
      reference: pay.reference || null,
      notes: pay.notes || null,
      receipt_url, receipt_path,
      recorded_by: user?.id,
    });
    setSavingPay(false);
    if (error) return toast.error(error.message);
    toast.success("Payment recorded");
    setPayOpen(false);
    setPay({ client_id: "", invoice_id: "", amount: 0, payment_date: today, method: "mpesa", reference: "", notes: "" });
    setPayFile(null);
    load();
  }

  async function del(id: string) {
    if (!confirm("Delete this invoice and its payments?")) return;
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  }

  const filtered = useMemo(() => rows.filter(r =>
    (statusFilter === "all" || r.status === statusFilter) &&
    (!q || r.invoice_number?.toLowerCase().includes(q.toLowerCase()) ||
      r.clients?.company_name?.toLowerCase().includes(q.toLowerCase()))
  ), [rows, q, statusFilter]);

  const kpi = useMemo(() => {
    const billed = rows.reduce((s, r) => s + Number(r.total || 0), 0);
    const collected = rows.reduce((s, r) => s + Number(r.amount_paid || 0), 0);
    const outstanding = billed - collected;
    const overdue = rows.filter(r => r.status === "overdue").reduce((s, r) => s + (Number(r.total) - Number(r.amount_paid)), 0);
    return { billed, collected, outstanding, overdue };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts & Billing</h1>
          <p className="text-sm text-muted-foreground">{rows.length} invoices</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPayOpen(true)} className="inline-flex items-center gap-2 px-3 h-9 rounded-md border text-sm font-medium">
            <Receipt className="h-4 w-4" /> Record Payment
          </button>
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium">
            <Plus className="h-4 w-4" /> New Invoice
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total Billed" value={money(kpi.billed)} icon={<FileText className="h-4 w-4" />} tone="blue" />
        <Kpi label="Collected" value={money(kpi.collected)} icon={<Wallet className="h-4 w-4" />} tone="emerald" />
        <Kpi label="Outstanding" value={money(kpi.outstanding)} icon={<TrendingUp className="h-4 w-4" />} tone="amber" />
        <Kpi label="Overdue" value={money(kpi.overdue)} icon={<AlertCircle className="h-4 w-4" />} tone="red" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search invoice # or client…" className="h-9 px-3 rounded-md border bg-background text-sm w-64" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 px-2 rounded-md border bg-background text-sm">
          <option value="all">All statuses</option>
          {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">Invoice #</th>
              <th className="text-left p-3">Client</th>
              <th className="text-left p-3">Service</th>
              <th className="text-left p-3">Issue</th>
              <th className="text-left p-3">Due</th>
              <th className="text-right p-3">Total</th>
              <th className="text-right p-3">Paid</th>
              <th className="text-right p-3">Balance</th>
              <th className="text-left p-3">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No invoices yet.</td></tr>
            )}
            {filtered.map(r => {
              const bal = Number(r.total || 0) - Number(r.amount_paid || 0);
              return (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="p-3"><Link to="/accounts/$id" params={{ id: r.id }} className="font-medium text-primary">{r.invoice_number}</Link></td>
                  <td className="p-3">{r.clients?.company_name ?? "—"}</td>
                  <td className="p-3">{r.service_line ?? "—"}</td>
                  <td className="p-3">{formatDate(r.issue_date)}</td>
                  <td className="p-3">{formatDate(r.due_date)}</td>
                  <td className="p-3 text-right">{money(r.total)}</td>
                  <td className="p-3 text-right text-emerald-700">{money(r.amount_paid)}</td>
                  <td className={`p-3 text-right ${bal > 0 ? "text-amber-700" : ""}`}>{money(bal)}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-muted"}`}>{r.status}</span></td>
                  <td className="p-3 text-right">
                    {isAdmin && <button onClick={() => del(r.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Recent payments (includes standalone) */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <div className="p-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent Payments</h2>
          <span className="text-xs text-muted-foreground">{payments.length} shown</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Client</th>
              <th className="text-left p-3">Invoice</th>
              <th className="text-left p-3">Method</th>
              <th className="text-left p-3">Reference</th>
              <th className="text-left p-3">Receipt</th>
              <th className="text-right p-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No payments recorded yet.</td></tr>}
            {payments.map(p => (
              <tr key={p.id} className="border-t hover:bg-muted/30">
                <td className="p-3">{formatDate(p.payment_date)}</td>
                <td className="p-3">{p.clients?.company_name ?? "—"}</td>
                <td className="p-3">{p.invoice_id
                  ? <Link to="/accounts/$id" params={{ id: p.invoice_id }} className="text-primary font-medium">{p.invoices?.invoice_number ?? "View"}</Link>
                  : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Standalone</span>}</td>
                <td className="p-3 capitalize">{p.method}</td>
                <td className="p-3 font-mono text-xs">{p.reference ?? "—"}</td>
                <td className="p-3">{p.receipt_path
                  ? <button onClick={() => openReceipt(p.receipt_path)} className="inline-flex items-center gap-1 text-primary text-xs hover:underline"><FileText className="h-3.5 w-3.5" /> View</button>
                  : <span className="text-xs text-muted-foreground">—</span>}</td>
                <td className="p-3 text-right font-medium text-emerald-700">{money(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>


      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={createInvoice} className="bg-background rounded-lg shadow-xl w-full max-w-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Invoice</h2>
              <button type="button" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <div>
              <label className="text-xs font-medium">Client *</label>
              <select required value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className="w-full h-9 px-2 border rounded-md bg-background text-sm">
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Issue Date</label>
                <input type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} className="w-full h-9 px-2 border rounded-md bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Due Date</label>
                <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="w-full h-9 px-2 border rounded-md bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Service Line</label>
                <select value={form.service_line} onChange={e => setForm({ ...form, service_line: e.target.value })} className="w-full h-9 px-2 border rounded-md bg-background text-sm">
                  {SERVICE_LINES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">VAT Rate (%)</label>
                <input type="number" step="0.01" value={form.vat_rate} onChange={e => setForm({ ...form, vat_rate: Number(e.target.value) })} className="w-full h-9 px-2 border rounded-md bg-background text-sm" />
              </div>
            </div>
            <div className="rounded-md border p-3 bg-muted/30 space-y-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Initial Amount (optional)</div>
              <input placeholder="Description" value={form.initial_description} onChange={e => setForm({ ...form, initial_description: e.target.value })} className="w-full h-9 px-2 border rounded-md bg-background text-sm" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">KES</span>
                <input type="number" step="0.01" placeholder="0.00" value={form.initial_amount || ""} onChange={e => setForm({ ...form, initial_amount: Number(e.target.value) })} className="flex-1 h-9 px-2 border rounded-md bg-background text-sm text-right" />
              </div>
              <div className="text-[11px] text-muted-foreground">Adds a first line item. You can add or edit more items after creating.</div>
            </div>
            <div>
              <label className="text-xs font-medium">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-2 py-1 border rounded-md bg-background text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="px-3 h-9 rounded-md border text-sm">Cancel</button>
              <button type="submit" className="px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm">Create Invoice</button>
            </div>
          </form>
        </div>
      )}

      {payOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPayOpen(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={recordPayment} className="bg-background rounded-lg shadow-xl w-full max-w-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Record Payment</h2>
              <button type="button" onClick={() => setPayOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">Record a payment against an invoice or as a standalone receipt (no invoice yet).</p>
            <div>
              <label className="text-xs font-medium">Client *</label>
              <select required value={pay.client_id} onChange={e => setPay({ ...pay, client_id: e.target.value, invoice_id: "" })} className="w-full h-9 px-2 border rounded-md bg-background text-sm">
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Link to Invoice (optional)</label>
              <select value={pay.invoice_id} onChange={e => setPay({ ...pay, invoice_id: e.target.value })} className="w-full h-9 px-2 border rounded-md bg-background text-sm" disabled={!pay.client_id}>
                <option value="">— Standalone (no invoice) —</option>
                {rows.filter(r => r.client_id === pay.client_id).map(r => (
                  <option key={r.id} value={r.id}>{r.invoice_number} · Bal {money(Number(r.total) - Number(r.amount_paid))}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Amount (KES) *</label>
                <input type="number" step="0.01" required value={pay.amount || ""} onChange={e => setPay({ ...pay, amount: Number(e.target.value) })} className="w-full h-9 px-2 border rounded-md bg-background text-sm text-right" />
              </div>
              <div>
                <label className="text-xs font-medium">Date</label>
                <input type="date" value={pay.payment_date} onChange={e => setPay({ ...pay, payment_date: e.target.value })} className="w-full h-9 px-2 border rounded-md bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Method</label>
                <select value={pay.method} onChange={e => setPay({ ...pay, method: e.target.value })} className="w-full h-9 px-2 border rounded-md bg-background text-sm">
                  {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Reference</label>
                <input value={pay.reference} onChange={e => setPay({ ...pay, reference: e.target.value })} placeholder="MPESA code, cheque #…" className="w-full h-9 px-2 border rounded-md bg-background text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Notes</label>
              <textarea value={pay.notes} onChange={e => setPay({ ...pay, notes: e.target.value })} rows={2} className="w-full px-2 py-1 border rounded-md bg-background text-sm" />
            </div>
            <div>
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer px-3 h-9 border rounded-md hover:bg-muted">
                <Paperclip className="h-3.5 w-3.5" /> {payFile ? payFile.name : "Attach receipt (image/PDF)"}
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => setPayFile(e.target.files?.[0] ?? null)} />
              </label>
              {payFile && <button type="button" onClick={() => setPayFile(null)} className="ml-2 text-xs text-muted-foreground hover:text-destructive">Clear</button>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setPayOpen(false)} className="px-3 h-9 rounded-md border text-sm">Cancel</button>
              <button type="submit" disabled={savingPay} className="px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50">{savingPay ? "Saving…" : "Record Payment"}</button>
            </div>
          </form>
        </div>
      )}
    </div>

  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "blue" | "emerald" | "amber" | "red" }) {
  const tones: any = {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200",
    red: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200",
  };
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`p-1.5 rounded-md ${tones[tone]}`}>{icon}</span>
      </div>
      <div className="mt-2 text-lg font-bold">{value}</div>
    </div>
  );
}
