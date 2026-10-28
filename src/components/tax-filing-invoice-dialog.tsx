import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { todayNairobi } from "@/lib/tax-period";

export type FilingBatchItem = {
  returnId: string;
  label: string;             // e.g. "PAYE"
  periodLabel: string;       // e.g. "due 9 Nov 2026"
  dueDate?: string | null;   // used for the invoice description month
  hasReceipt: boolean;       // a filing receipt is already attached
  invoiceId?: string | null; // already linked to an invoice (e.g. a retry)
};

/**
 * File some of a client's tax obligations and bill them on the client's ONE
 * invoice for the month: the first filing of the month creates a draft invoice,
 * later filings are added to that same invoice (one line per obligation) until
 * it is sent. Steps: upload any missing receipts -> create_tax_filing_invoice
 * (creates or extends the month's invoice and links every selected return) ->
 * mark all selected returns filed in a single update.
 */
export function TaxFilingInvoiceDialog({
  open, onOpenChange, clientName, clientId, items, onUploadReceipt, onDone, onInvoiceCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientName?: string | null;
  clientId: string;
  items: FilingBatchItem[];
  /** Saves a receipt for one return; resolves true when stored. */
  onUploadReceipt: (returnId: string, clientId: string, file: File) => Promise<boolean>;
  onDone: () => void | Promise<void>;
  /** Called with the new invoice id once the invoice exists (e.g. to show it). */
  onInvoiceCreated?: (invoiceId: string) => void;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [busy, setBusy] = useState(false);
  // This month's still-draft tax invoice for the client, if one already exists
  // (preview only - the database makes the real decision).
  const [existing, setExisting] = useState<{ id: string; invoice_number: string; subtotal: number; memo: string | null } | null>(null);

  useEffect(() => {
    if (open) { setAmounts({}); setFiles({}); }
  }, [open, items.map(i => i.returnId).join(",")]);

  useEffect(() => {
    if (!open || !clientId) { setExisting(null); return; }
    let cancelled = false;
    (async () => {
      const month = todayNairobi().slice(0, 7);
      const [y, m] = month.split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      const { data: links } = await supabase.from("tax_returns").select("invoice_id").eq("client_id", clientId).not("invoice_id", "is", null);
      const ids = [...new Set((links ?? []).map((l: any) => l.invoice_id))];
      if (!ids.length) { if (!cancelled) setExisting(null); return; }
      const { data: invs } = await supabase.from("invoices")
        .select("id, invoice_number, subtotal, memo")
        .in("id", ids).eq("status", "draft")
        .gte("issue_date", `${month}-01`).lte("issue_date", `${month}-${String(last).padStart(2, "0")}`)
        .order("issue_date", { ascending: false }).order("created_at", { ascending: false }).limit(1);
      if (!cancelled) setExisting((invs as any)?.[0] ?? null);
    })();
    return () => { cancelled = true; };
  }, [open, clientId]);

  const toInvoice = useMemo(() => items.filter(i => !i.invoiceId), [items]);
  const total = toInvoice.reduce((sum, i) => sum + (Number(amounts[i.returnId]) || 0), 0);

  // Invoice description: what is being filed now, in this month's invoice.
  const monthLabel = new Date(`${todayNairobi().slice(0, 7)}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  const description = items.length ? `Tax filings: ${items.map(i => i.label).join(", ")} - ${monthLabel}` : "";
  const newSubtotal = (existing ? Number(existing.subtotal || 0) : 0) + total;

  async function submit() {
    if (toInvoice.length) {
      if (toInvoice.some(i => { const n = Number(amounts[i.returnId] || 0); return !Number.isFinite(n) || n < 0; })) {
        toast.error("Amounts must be zero or more"); return;
      }
      if (total <= 0) { toast.error("Enter the amount to invoice"); return; }
    }
    const missing = items.filter(i => !i.hasReceipt && !files[i.returnId]);
    if (missing.length) { toast.error(`Attach the filing receipt for: ${missing.map(m => m.label).join(", ")}`); return; }

    setBusy(true);
    let invoiceNote = "invoice updated";
    for (const i of items) {
      const f = files[i.returnId];
      if (!i.hasReceipt && f) {
        const stored = await onUploadReceipt(i.returnId, clientId, f);
        if (!stored) { setBusy(false); return; }
      }
    }

    if (toInvoice.length) {
      const payload = toInvoice.map(i => ({
        return_id: i.returnId,
        description: `${i.label} filing — ${i.periodLabel}`,
        amount: Number(amounts[i.returnId] || 0),
      }));
      const { data: result, error } = await supabase.rpc("create_tax_filing_invoice" as any, { _items: payload } as any);
      if (error) { setBusy(false); toast.error(error.message); return; }
      const r = result as any;
      invoiceNote = r?.created ? "one invoice generated" : `added to invoice ${r?.invoice_number ?? ""}`.trim();
      if (r?.invoice_id) onInvoiceCreated?.(r.invoice_id as string);
    }

    const { data, error } = await supabase.from("tax_returns")
      .update({ status: "filed" }).in("id", items.map(i => i.returnId)).select("id");
    if (error) {
      setBusy(false);
      toast.error(`${error.message} — the invoice was created; reopen this dialog to finish filing.`);
      await onDone();
      return;
    }
    if (!data || data.length !== items.length) {
      toast.error("Some returns could not be filed — you may not have permission for all of them.");
    } else {
      toast.success(`${items.length} obligation${items.length === 1 ? "" : "s"} filed · ${invoiceNote}`);
    }
    try { await onDone(); } finally { setBusy(false); }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={o => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>File selected obligations &amp; generate one invoice</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {existing ? (
              <>These obligations will be <span className="font-medium text-foreground">added to this month&apos;s invoice {existing.invoice_number}</span>{clientName ? <> for <span className="font-medium text-foreground">{clientName}</span></> : null} (still a draft).</>
            ) : (
              <>A new draft invoice{clientName ? <> for <span className="font-medium text-foreground">{clientName}</span></> : null} will be created for this month; later filings this month are added to it.</>
            )}{" "}Enter the amount for each obligation (KES, before VAT).
          </p>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {items.map(i => (
              <div key={i.returnId} className="rounded-md border p-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{i.label}</div>
                    <div className="text-[11px] text-muted-foreground">{i.periodLabel}</div>
                  </div>
                  {i.invoiceId ? (
                    <span className="text-[11px] text-muted-foreground">Already invoiced</span>
                  ) : (
                    <div className="w-36">
                      <Label className="text-[11px]">Amount *</Label>
                      <Input type="number" min="0" step="0.01" value={amounts[i.returnId] ?? ""} onChange={e => setAmounts(a => ({ ...a, [i.returnId]: e.target.value }))} />
                    </div>
                  )}
                </div>
                {!i.hasReceipt && (
                  <div>
                    <Label className="text-[11px]">Filing receipt *</Label>
                    <Input type="file" onChange={e => setFiles(f => ({ ...f, [i.returnId]: e.target.files?.[0] ?? null }))} />
                  </div>
                )}
              </div>
            ))}
          </div>
          {description && (
            <div className="text-xs text-muted-foreground border-t pt-2">
              <span className="font-medium text-foreground">Invoice description: </span>{description}
            </div>
          )}
          {toInvoice.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{existing ? "Adding now (before VAT)" : "Invoice total (before VAT)"}</span>
              <span className="font-semibold">KES {total.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          {existing && toInvoice.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Invoice subtotal after adding (before VAT)</span>
              <span className="font-semibold">KES {newSubtotal.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}><Receipt className="h-3.5 w-3.5 mr-1" />{busy ? "Working…" : existing ? `File ${items.length} & add to invoice` : `File ${items.length} & generate invoice`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
