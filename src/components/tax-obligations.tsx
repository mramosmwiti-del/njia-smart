import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTaxObligations } from "./tax-obligations/use-tax-obligations";
import { ObligationGroup } from "./tax-obligations/obligation-group";
import { ObligationBatchInvoiceDialog } from "./tax-obligations/obligation-batch-invoice-dialog";
import { AddObligationDialog } from "./tax-obligations/add-obligation-dialog";
import { AttachDocumentDialog } from "./tax-obligations/attach-document-dialog";
import { BillFilingDialog } from "./tax-obligations/bill-filing-dialog";
import type { TaxObligationsProps } from "./tax-obligations/constants";

// Thin shell: state and data live in use-tax-obligations; the list and each
// dialog are their own components under ./tax-obligations/.
export function TaxObligations({ clientId, hideAdd = false, reloadKey, focusType }: TaxObligationsProps) {
  const ctx = useTaxObligations({ clientId, reloadKey, focusType });
  const { canCreate, setAddOpen, types, byType, rows, invoiceFor, setInvoiceFor, typeLabel, load } = ctx;
  return (
    <div className="space-y-3">
      {!hideAdd && (
        <div className="flex justify-end">
          {canCreate("tax") && (
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" />Add obligation</Button>
          )}
        </div>
      )}

      {types.length === 0 && (
        <div className="bg-card border rounded-lg p-8 text-center text-muted-foreground text-sm">No tax obligations yet.</div>
      )}

      {types.map(type => <ObligationGroup key={type} ctx={ctx} type={type} />)}

      {invoiceFor && (
        <ObligationBatchInvoiceDialog
          open
          currentRow={invoiceFor}
          rows={rows.filter(r => r.status !== "filed" && !r.invoice_id)}
          typeLabel={typeLabel}
          onOpenChange={o => { if (!o) setInvoiceFor(null); }}
          onCompleted={async () => { setInvoiceFor(null); await load(); }}
        />
      )}

      <AddObligationDialog ctx={ctx} />
      <AttachDocumentDialog ctx={ctx} />
      <BillFilingDialog ctx={ctx} />
    </div>
  );
}
