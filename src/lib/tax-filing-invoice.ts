import { supabase } from "@/integrations/supabase/client";

// Shared by every screen that files tax obligations and bills them.
// The database function create_tax_filing_invoice enforces the rules (one
// client per call, nothing already filed or invoiced, one draft invoice per
// client per month); these helpers only call it and normalise the result.

export type TaxInvoiceLine = { returnId: string; description: string; amount: number };
export type TaxInvoiceResult = { invoiceId: string; invoiceNumber: string | null; created: boolean };

/** Creates (or extends) the client's monthly tax invoice. Throws with the database's message on failure. */
export async function createTaxFilingInvoice(lines: TaxInvoiceLine[]): Promise<TaxInvoiceResult> {
  const payload = lines.map(l => ({ return_id: l.returnId, description: l.description, amount: l.amount }));
  const { data, error } = await supabase.rpc("create_tax_filing_invoice" as any, { _items: payload } as any);
  if (error) throw error;
  if (!data) throw new Error("Could not create the tax invoice.");
  // Older database versions returned only the invoice id; newer ones return an object.
  const r = data as any;
  const invoiceId: string | undefined = typeof r === "string" ? r : r.invoice_id;
  if (!invoiceId) throw new Error("Invoice was created but its ID was not returned.");
  return {
    invoiceId,
    invoiceNumber: typeof r === "string" ? null : (r.invoice_number ?? null),
    created: typeof r === "string" ? true : !!r.created,
  };
}

/** Marks the given returns filed in one update. `filed` is how many rows actually changed (permissions can filter some out). */
export async function markReturnsFiled(ids: string[]): Promise<{ filed: number; error: string | null }> {
  const { data, error } = await supabase.from("tax_returns").update({ status: "filed" }).in("id", ids).select("id");
  return { filed: data?.length ?? 0, error: error?.message ?? null };
}
