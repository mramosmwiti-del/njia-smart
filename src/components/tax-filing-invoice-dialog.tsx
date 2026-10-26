import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export type FilingBatchItem = {
  returnId: string;
  label: string;             // e.g. "PAYE"
  periodLabel: string;       // e.g. "period ending 31 Oct 2026"
  hasReceipt: boolean;       // a filing receipt is already attached
  invoiceId?: string | null; // already linked to an invoice (e.g. a retry)
};

/**
 * File several of one client's tax obligations together and raise ONE invoice
 * for them (one line per obligation). Steps: upload any missing receipts ->
 * create_tax_filing_invoice (one invoice, linked to every selected return) ->
 * mark all selected returns filed in a single update.
 */
export function TaxFilingInvoiceDialog({
  open, onOpenChange, clientName, clientId, items, onUploadReceipt, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientName?: string | null;
  clientId: string;
  items: FilingBatchItem[];
  /** Saves a receipt for one return; resolves true when stored. */
  onUploadReceipt: (returnId: string, clientId: string, file: File) => Promise<boolean>;
  onDone: () => void | Promise<void>;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setAmounts({}); setFiles({}); }
  }, [open, items.map(i => i.returnId).join(",")]);

  const toInvoice = useMemo(() => items.filter(i => !i.invoiceId), [items]);
  const total = toInvoice.reduce((sum, i) => sum + (Number(amounts[i.returnId]) || 0), 0);

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
      const { error } = await supabase.rpc("create_tax_filing_invoice" as any, { _items: payload } as any);
      if (error) { setBusy(false); toast.error(error.message); return; }
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
      toast.success(`${items.length} obligation${items.length === 1 ? "" : "s"} filed · one invoice generated`);
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
            One invoice{clientName ? <> for <span className="font-medium text-foreground">{clientName}</span></> : null} covering the obligations below, created as a draft. Enter the amount for each (KES, before VAT).
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
          {toInvoice.length > 0 && (
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground">Invoice total (before VAT)</span>
              <span className="font-semibold">KES {total.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}><Receipt className="h-3.5 w-3.5 mr-1" />{busy ? "Working…" : `File ${items.length} & generate invoice`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
