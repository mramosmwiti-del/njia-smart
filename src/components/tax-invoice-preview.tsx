import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, STATUS_COLORS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const money = (n: any) => "KES " + Number(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function termsOf(issue?: string | null, due?: string | null) {
  if (!issue || !due) return "—";
  const d = Math.round((new Date(due).getTime() - new Date(issue).getTime()) / 86400000);
  return d <= 0 ? "Due on receipt" : `Net ${d} days`;
}

/**
 * Read-only invoice view for the Tax module: invoice number, issue / due dates,
 * client details (KRA PIN, contacts), every line with its tax code and VAT,
 * subtotal, VAT amount, total, amount paid and balance due, plus the invoice
 * description. Print / PDF opens the invoice on its own; "Open in Accounts"
 * goes to the full invoice page (payments, editing).
 */
export function TaxInvoicePreviewDialog({
  invoiceId, onOpenChange,
}: {
  invoiceId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [inv, setInv] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!invoiceId) { setInv(null); setItems([]); setFailed(false); return; }
    let cancelled = false;
    setLoading(true); setFailed(false);
    (async () => {
      const [{ data: i, error }, { data: it }] = await Promise.all([
        supabase.from("invoices").select("*, clients(id, company_name, kra_pin, email, phone)").eq("id", invoiceId).maybeSingle(),
        supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId).order("sort_order"),
      ]);
      if (cancelled) return;
      setLoading(false);
      if (error || !i) { setFailed(true); return; }
      setInv(i); setItems(it ?? []);
    })();
    return () => { cancelled = true; };
  }, [invoiceId]);

  function print() {
    if (!sheet.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map(n => n.outerHTML).join("");
    w.document.write(`<html><head><title>${inv?.invoice_number ?? "Invoice"}</title>${styles}</head><body style="padding:24px;background:#fff;color:#111">${sheet.current.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
  }

  const balance = Math.max(0, Number(inv?.total || 0) - Number(inv?.amount_paid || 0));

  return (
    <Dialog open={!!invoiceId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle>Invoice{inv ? ` ${inv.invoice_number}` : ""}</DialogTitle>
            {inv && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={print}><Printer className="h-3.5 w-3.5 mr-1" />Print / PDF</Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/accounts/$id" params={{ id: inv.id }}><ExternalLink className="h-3.5 w-3.5 mr-1" />Open in Accounts</Link>
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground py-6 text-center">Loading invoice…</p>}
        {failed && <p className="text-sm text-destructive py-6 text-center">Couldn't load this invoice — it may have been removed, or you may not have access to it.</p>}

        {inv && (
          <div ref={sheet} className="rounded-lg border bg-card p-6 text-sm">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-xl font-bold">G.K Nahashon &amp; Company</div>
                <div className="text-xs text-muted-foreground">Certified Public Accountants, Auditors, Tax &amp; Advisory</div>
                <div className="text-xs text-muted-foreground">Nairobi, Kenya</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">INVOICE</div>
                <div className="font-mono">{inv.invoice_number}</div>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[inv.status] ?? "bg-muted"}`}>{inv.status}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Bill To</div>
                <div className="font-semibold">{inv.clients?.company_name}</div>
                {inv.clients?.kra_pin && <div className="text-xs">KRA PIN: {inv.clients.kra_pin}</div>}
                {inv.clients?.email && <div className="text-xs">{inv.clients.email}</div>}
                {inv.clients?.phone && <div className="text-xs">{inv.clients.phone}</div>}
              </div>
              <div className="text-right space-y-1">
                <div><span className="text-xs text-muted-foreground">Invoice date: </span>{formatDate(inv.issue_date)}</div>
                <div><span className="text-xs text-muted-foreground">Due date: </span>{formatDate(inv.due_date)}</div>
                <div><span className="text-xs text-muted-foreground">Terms: </span>{termsOf(inv.issue_date, inv.due_date)}</div>
                {inv.location && <div><span className="text-xs text-muted-foreground">Location: </span>{inv.location}</div>}
                <div><span className="text-xs text-muted-foreground">Service: </span>{inv.service_line ?? "—"}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full mb-4">
                <thead className="border-b">
                  <tr className="text-xs uppercase text-muted-foreground">
                    <th className="text-left py-2">Description</th>
                    <th className="text-right py-2 w-14">Qty</th>
                    <th className="text-right py-2 w-28">Rate</th>
                    <th className="text-right py-2 w-28">Amount</th>
                    <th className="text-right py-2 w-32">Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No line items.</td></tr>}
                  {items.map(it => (
                    <tr key={it.id} className="border-b align-top">
                      <td className="py-2">
                        {it.item_name && <div className="font-medium">{it.item_name}</div>}
                        <div className={it.item_name ? "text-xs text-muted-foreground" : ""}>{it.description}</div>
                        {it.service_date && <div className="text-[11px] text-muted-foreground">Service date: {formatDate(it.service_date)}</div>}
                      </td>
                      <td className="py-2 text-right">{Number(it.quantity)}</td>
                      <td className="py-2 text-right">{money(it.unit_price)}</td>
                      <td className="py-2 text-right font-medium">{money(it.amount)}</td>
                      <td className="py-2 text-right">
                        <div className="text-xs">{it.tax_code ?? "Standard"}</div>
                        <div className="text-[11px] text-muted-foreground">{money(it.tax_amount)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{money(inv.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">VAT ({Number(inv.vat_rate)}%)</span><span>{money(inv.vat_amount)}</span></div>
                <div className="flex justify-between border-t pt-1 font-bold text-base"><span>Total</span><span>{money(inv.total)}</span></div>
                <div className="flex justify-between text-emerald-700"><span>Amount paid</span><span>{money(inv.amount_paid)}</span></div>
                <div className="flex justify-between border-t pt-1 font-bold text-base"><span>Balance due</span><span className={balance > 0 ? "text-amber-700" : "text-emerald-700"}>{money(balance)}</span></div>
              </div>
            </div>

            {inv.memo && <div className="mt-4 text-xs text-muted-foreground border-t pt-3"><strong>Description:</strong> {inv.memo}</div>}
            {inv.notes && <div className="mt-2 text-xs text-muted-foreground"><strong>Notes:</strong> {inv.notes}</div>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
