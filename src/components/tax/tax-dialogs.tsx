import { formatDate } from "@/lib/format";
import { CompletionInvoiceDialog } from "@/components/completion-invoice-dialog";
import { TaxFilingInvoiceDialog } from "@/components/tax-filing-invoice-dialog";
import type { TaxCtx } from "./use-tax-page";

export function TaxDialogs({ ctx }: { ctx: TaxCtx }) {
  const { policies, returns, clients, documentsByReturn, invoiceFor, setInvoiceFor, batchFor, setBatchFor, load, uploadReceipt, markFiled } = ctx;
  return (
    <>
      {batchFor && (
        <TaxFilingInvoiceDialog
          open
          onOpenChange={o => { if (!o) setBatchFor(null); }}
          clientId={batchFor.clientId}
          clientName={clients.find((x: any) => x.id === batchFor.clientId)?.company_name}
          items={batchFor.returnIds
            .map(id => returns.find((r: any) => r.id === id))
            .filter((r: any) => r && r.status !== "filed")
            .map((r: any) => ({
              returnId: r.id,
              label: policies.find((x: any) => x.tax_type === r.return_type)?.label ?? r.return_type,
              periodLabel: `period ending ${formatDate(r.period_end)}`,
              hasReceipt: !!documentsByReturn.get(r.id)?.length,
              invoiceId: r.invoice_id,
            }))}
          onUploadReceipt={(returnId, clientId, file) => uploadReceipt(returnId, clientId, file)}
          onDone={() => load(true)}
        />
      )}
      {invoiceFor && (
        <CompletionInvoiceDialog
          open
          onOpenChange={o => { if (!o) setInvoiceFor(null); }}
          source="tax_returns"
          sourceId={invoiceFor.id}
          clientName={invoiceFor.clientName}
          defaultDescription={invoiceFor.description}
          requireFile={invoiceFor.needsReceipt}
          fileLabel="Filing receipt"
          onUploadFile={file => uploadReceipt(invoiceFor.id, invoiceFor.clientId, file)}
          onInvoiced={async () => { await markFiled(invoiceFor.id, true, true); setInvoiceFor(null); }}
        />
      )}
    </>
  );
}
