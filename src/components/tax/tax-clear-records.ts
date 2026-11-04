import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ClearRecordsInput = {
  isAdmin: boolean;
  clearRecordsClientId: string;
  clients: any[];
  returns: any[];
  documentsByReturn: Map<string, any[]>;
  setClearingRecords: (v: boolean) => void;
  setClearRecordsClientId: (v: string) => void;
  load: (silent?: boolean) => Promise<void>;
};

// Permanently clears filing records (and their linked documents/files) for one
// client or for all clients. Destructive: guarded by an admin check and a confirm.
export async function clearClientFilingRecords({
  isAdmin, clearRecordsClientId, clients, returns, documentsByReturn, setClearingRecords, setClearRecordsClientId, load,
}: ClearRecordsInput) {
  if (!isAdmin) {
    toast.error("Only Admin or Director can clear filing records.");
    return;
  }
  const clearAll = clearRecordsClientId === "__all__";
  const client = clearAll ? null : clients.find((item: any) => item.id === clearRecordsClientId);
  if (!clearAll && !client) {
    toast.error("Select a client or choose All first.");
    return;
  }
  const targetReturns = clearAll ? returns : returns.filter((item: any) => item.client_id === client!.id);
  if (targetReturns.length === 0) {
    toast.info(clearAll ? "There are no filing records to clear." : "This client has no filing records to clear.");
    return;
  }
  const returnIds = targetReturns.map((item: any) => item.id);
  const docs = returnIds.flatMap((id: string) => documentsByReturn.get(id) ?? []);
  const targetName = clearAll ? "ALL clients" : client!.company_name;
  const message = `PERMANENTLY clear ${targetReturns.length} filing record(s) and ${docs.length} linked document(s) for ${targetName}? Actual files will be removed from Storage. Client profiles, tax obligations, and invoices will be kept. Active obligations may generate fresh current filing records.`;
  if (!window.confirm(message)) return;

  setClearingRecords(true);
  try {
    const paths = [...new Set(docs.map((doc: any) => doc.file_path).filter((path: any): path is string => typeof path === "string" && path.length > 0))];
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from("client-documents").remove(paths);
      if (storageError) {
        toast.error(`Storage deletion failed. Filing records were not cleared: ${storageError.message}`);
        return;
      }
    }

    if (docs.length) {
      const docIds = docs.map((doc: any) => doc.id);
      const { error: docsError } = await supabase.from("documents").delete().in("id", docIds);
      if (docsError) {
        toast.error(`Files were removed, but document metadata could not be cleared: ${docsError.message}`);
        await load(true);
        return;
      }
    }

    const { error: assigneeError } = await supabase.from("tax_return_assignees" as any).delete().in("tax_return_id", returnIds);
    if (assigneeError) {
      toast.error(`Documents were removed, but filing assignments could not be cleared: ${assigneeError.message}`);
      await load(true);
      return;
    }

    const { error: returnsError } = clearAll
      ? await supabase.from("tax_returns").delete().in("id", returnIds)
      : await supabase.from("tax_returns").delete().eq("client_id", client!.id);
    if (returnsError) {
      toast.error(`Documents were removed, but filing records could not be cleared: ${returnsError.message}`);
      await load(true);
      return;
    }

    toast.success(clearAll ? `Cleared filing records for all clients (${targetReturns.length} records).` : `Cleared filing records for ${client!.company_name}.`);
    setClearRecordsClientId("");
    await load(true);
  } catch (error: any) {
    toast.error(error?.message || "Unable to clear filing records.");
    await load(true);
  } finally {
    setClearingRecords(false);
  }
}
