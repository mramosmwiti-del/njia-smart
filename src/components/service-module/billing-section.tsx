import { formatDate, STATUS_COLORS } from "@/lib/format";
import type { ServiceModuleCtx } from "./use-service-module";

export function BillingSection({ ctx }: { ctx: ServiceModuleCtx }) {
  const { tab, billingFilter, setBillingFilter, visibleInvoices, moduleLabel } = ctx;
  return (
    <>
      {tab === "billing" && billingFilter === "balance" && (
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-primary/10 text-primary">Invoices with a balance due · {visibleInvoices.length}</span>
          <button onClick={() => setBillingFilter(null)} className="text-muted-foreground hover:text-foreground underline">Show all invoices</button>
        </div>
      )}

      {tab === "billing" && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b bg-muted/40">
                <tr><th className="py-2 px-3">Client</th><th>Invoice</th><th>Issued</th><th>Due</th><th>Total</th><th>Paid</th><th>Status</th></tr>
              </thead>
              <tbody>
                {visibleInvoices.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">No invoices tagged “{moduleLabel}” yet. Set the Service Line to “{moduleLabel}” when creating an invoice in Accounts.</td></tr>}
                {visibleInvoices.map(inv => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{inv.clients?.company_name}</td>
                    <td>{inv.invoice_number}</td>
                    <td>{formatDate(inv.issue_date)}</td>
                    <td>{formatDate(inv.due_date)}</td>
                    <td>{Number(inv.total ?? 0).toLocaleString()}</td>
                    <td>{Number(inv.amount_paid ?? 0).toLocaleString()}</td>
                    <td><span className={`text-xs px-2 py-1 rounded-full capitalize ${STATUS_COLORS[inv.status] || "bg-muted"}`}>{inv.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
