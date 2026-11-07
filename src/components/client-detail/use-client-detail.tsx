import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { formatDate } from "@/lib/format";
import { TABS } from "./constants";

export function useClientDetail(id: string, search: { tab?: string; obligation?: string }) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [client, setClient] = useState<any>(null);
  const [tab, setTab] = useState<typeof TABS[number]>(
    (TABS as readonly string[]).includes(search.tab ?? "") ? (search.tab as typeof TABS[number]) : "Overview"
  );
  const [related, setRelated] = useState<any>({ tax: [], engagements: [], advisory: [], docs: [], tasks: [], contacts: [] });
  const [taxPolicies, setTaxPolicies] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [addOpen, setAddOpen] = useState<null | "tax" | "audit" | "advisory" | "document" | "task">(null);
  const [addForm, setAddForm] = useState<any>({});
  const [addBusy, setAddBusy] = useState(false);
  const [addFile, setAddFile] = useState<File | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [editPwd, setEditPwd] = useState(false);
  const [pwdValue, setPwdValue] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [updaterName, setUpdaterName] = useState<string | null>(null);
  const [recordUpdaterName, setRecordUpdaterName] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
    setClient(data);
    const updaterId = (data as any)?.portal_password_updated_by;
    const recordUpdaterId = (data as any)?.updated_by;
    const [prof, recordProf] = await Promise.all([
      updaterId ? supabase.from("profiles").select("full_name").eq("id", updaterId).maybeSingle() : Promise.resolve({ data: null }),
      recordUpdaterId ? supabase.from("profiles").select("full_name").eq("id", recordUpdaterId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setUpdaterName((prof.data as any)?.full_name ?? null);
    setRecordUpdaterName((recordProf.data as any)?.full_name ?? null);
    const [tax, eng, adv, docs, tasks, contacts, pols, obl] = await Promise.all([
      supabase.from("tax_returns").select("*").eq("client_id", id).order("due_date"),
      supabase.from("engagements").select("*").eq("client_id", id).order("updated_at", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("advisory_projects").select("*").eq("client_id", id),
      supabase.from("documents").select("*").eq("client_id", id).order("updated_at", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").eq("client_id", id).order("updated_at", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("client_contacts").select("*").eq("client_id", id),
      supabase.from("tax_policies").select("*").eq("active", true).order("sort_order"),
      supabase.from("client_tax_obligations").select("*").eq("client_id", id).eq("active", true),
    ]);
    setRelated({ tax: tax.data ?? [], engagements: eng.data ?? [], advisory: adv.data ?? [], docs: docs.data ?? [], tasks: tasks.data ?? [], contacts: contacts.data ?? [] });
    setTaxPolicies((pols.data as any[]) ?? []);
    setObligations(obl.data ?? []);
  }
  useEffect(() => { load(); }, [id]);

  async function openDocument(doc: any, download = false) {
    if (!doc.file_path) { toast.error("This document has no stored file."); return; }
    try {
      const bucket = doc.storage_bucket || "client-documents";
      const options = download ? { download: true } : undefined;
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(doc.file_path, 60, options as any);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast.error(error?.message || "Could not open this document.");
    }
  }

  async function deleteClientDocument(doc: any) {
    if (!isAdmin) { toast.error("Only Admin or Director can delete documents."); return; }
    if (!window.confirm(`Delete “${doc.title || "this document"}” from this client and the central Document module? This cannot be undone.`)) return;
    try {
      const bucket = doc.storage_bucket || "client-documents";
      if (doc.file_path) {
        const { error: storageError } = await supabase.storage.from(bucket).remove([doc.file_path]);
        if (storageError) throw new Error(`The file was not deleted: ${storageError.message}`);
      }
      const { error } = await supabase.from("documents").delete().eq("id", doc.id).eq("client_id", id);
      if (error) throw new Error(`The stored file was removed, but its document record could not be deleted: ${error.message}`);
      toast.success("Document deleted from the client and central Document module.");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Could not delete this document.");
      await load();
    }
  }

  async function setPaused(paused: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("clients").update(
      paused ? { is_paused: true, paused_at: new Date().toISOString(), paused_by: user?.id ?? null } as any
             : { is_paused: false, paused_at: null, paused_by: null } as any
    ).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(paused ? "Client marked inactive" : "Client marked active"); load(); }
  }

  function openEdit() {
    setForm({
      client_type: (client as any).client_type ?? "company",
      company_name: client.company_name ?? "",
      first_name: (client as any).first_name ?? "",
      last_name: (client as any).last_name ?? "",
      id_number: (client as any).id_number ?? "",
      kra_pin: client.kra_pin ?? "",
      reg_number: client.reg_number ?? "",
      industry: client.industry ?? "",
      engagement_type: client.engagement_type ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      notes: client.notes ?? "",
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!form.company_name?.trim()) { toast.error("Name required"); return; }
    const { error } = await supabase.from("clients").update(form).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Client updated");
    setEditOpen(false);
    load();
  }

  async function deleteClient() {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Client deleted");
    navigate({ to: "/clients" });
  }

  async function deleteFilingRecord(returnId: string) {
    if (!isAdmin) {
      toast.error("Only Admin or Director can delete filing history.");
      return;
    }
    const filing = related.tax.find((row: any) => row.id === returnId);
    if (!filing) { toast.error("Filing record not found."); return; }
    const label = `${filing.return_type?.replace(/_/g, " ") ?? "filing"} (${formatDate(filing.due_date)})`;
    if (!window.confirm(`Permanently delete this ${label} for this client? Linked uploaded files, document records, and filing assignments will also be deleted. Client details, tax obligations, and invoices will be kept. This cannot be undone.`)) return;

    try {
      const { data: docs, error: docsLoadError } = await supabase
        .from("documents")
        .select("id, file_path")
        .eq("tax_return_id", returnId);
      if (docsLoadError) throw new Error(`Could not load linked documents: ${docsLoadError.message}`);

      const paths = [...new Set((docs ?? []).map((doc: any) => doc.file_path).filter((path: any): path is string => typeof path === "string" && path.length > 0))];
      if (paths.length) {
        const { error } = await supabase.storage.from("client-documents").remove(paths);
        if (error) throw new Error(`Could not delete uploaded files; filing record was kept: ${error.message}`);
      }

      const docIds = (docs ?? []).map((doc: any) => doc.id);
      if (docIds.length) {
        const { error } = await supabase.from("documents").delete().in("id", docIds);
        if (error) throw new Error(`Uploaded files were removed, but document records could not be deleted: ${error.message}`);
      }

      const { error: assigneeError } = await supabase.from("tax_return_assignees" as any).delete().eq("tax_return_id", returnId);
      if (assigneeError) throw new Error(`Linked documents were removed, but filing assignments could not be deleted: ${assigneeError.message}`);

      const { error: returnError } = await supabase.from("tax_returns").delete().eq("id", returnId).eq("client_id", id);
      if (returnError) throw new Error(`Linked files and assignments were removed, but the filing record could not be deleted: ${returnError.message}`);

      toast.success("Filing history and linked records deleted.");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Unable to delete filing history.");
      await load();
    }
  }

  function openAdd(kind: NonNullable<typeof addOpen>) {
    const defaults: any = {
      tax: { return_types: [] as string[] },
      audit: { title: "", due_date: "", notes: "" },
      advisory: { title: "", description: "", due_date: "" },
      document: { title: "" },
      task: { title: "", priority: "normal", due_date: "", description: "" },
    };
    setAddForm(kind === "tax"
      ? { ...defaults.tax, return_types: obligations.filter((o: any) => o.active).map((o: any) => o.tax_type) }
      : defaults[kind]);
    setAddFile(null);
    setAddOpen(kind);
  }

  async function submitAdd() {
    if (!addOpen) return;
    setAddBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    try {
      if (addOpen === "tax") {
        const types: string[] = (addForm.return_types ?? []).filter(Boolean);
        if (types.length === 0 && !obligations.some((o: any) => o.active)) throw new Error("Select at least one tax obligation");
        // Due dates aren't picked here — each type's own policy (cadence + due
        // day, set by admins under Settings) decides when the first filing is due.
        const existingTypes = obligations.filter((o: any) => o.active).map((o: any) => o.tax_type as string);
        // Unticking an obligation stops it and removes its unfiled, un-invoiced
        // periods. Say so before doing it, so a stray click can't do it silently.
        const dropped = existingTypes.filter((t: string) => !types.includes(t));
        if (dropped.length > 0) {
          const names = dropped.map((t: string) => taxPolicies.find((p: any) => p.tax_type === t)?.label ?? t).join(", ");
          if (!window.confirm(`Stop ${names} for this client?\n\nUnfiled periods with no invoice will be removed and nothing new will be scheduled. Filed records, invoices and documents are kept.`)) return;
        }
        // Persist the selected obligations and deactivate any previously assigned
        // types that were unchecked. Remove only unused pending periods; filed,
        // in-progress, invoiced, and documented records are retained.
        for (const rt of types) {
          if (existingTypes.includes(rt)) continue;
          const { error } = await supabase.rpc("set_client_tax_obligation", {
            _client_id: id, _tax_type: rt, _active: true,
          });
          if (error) throw error;
        }
        for (const rt of existingTypes.filter((t: string) => !types.includes(t))) {
          const { error } = await supabase.rpc("set_client_tax_obligation", {
            _client_id: id, _tax_type: rt, _active: false,
          });
          if (error) throw error;
          const { error: cleanupError } = await supabase.from("tax_returns")
            .delete()
            .eq("client_id", id)
            .eq("return_type", rt)
            .eq("status", "pending")
            .is("invoice_id", null);
          if (cleanupError) throw cleanupError;
        }
      } else if (addOpen === "audit" || addOpen === "advisory") {
        if (!addForm.title?.trim()) throw new Error("Title required");
        if (addOpen === "audit") {
          const { error } = await supabase.from("engagements").insert({
            client_id: id, type: "audit", title: addForm.title,
            due_date: addForm.due_date || null, notes: addForm.notes || null,
          } as any);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("advisory_projects").insert({
            client_id: id, title: addForm.title,
            description: addForm.description || null,
            due_date: addForm.due_date || null,
          } as any);
          if (error) throw error;
        }
      } else if (addOpen === "document") {
        if (!addFile) throw new Error("Choose a file");
        const path = `${id}/${Date.now()}-${addFile.name}`;
        const up = await supabase.storage.from("client-documents").upload(path, addFile);
        if (up.error) throw up.error;
        const { error } = await supabase.from("documents").insert({
          client_id: id,
          title: addForm.title || addFile.name,
          file_path: path,
          uploaded_by: user?.id ?? null,
        } as any);
        if (error) throw error;
      } else if (addOpen === "task") {
        if (!addForm.title?.trim()) throw new Error("Title required");
        const { error } = await supabase.from("tasks").insert({
          client_id: id, title: addForm.title,
          priority: addForm.priority, due_date: addForm.due_date || null,
          description: addForm.description || null, created_by: user?.id ?? null,
        } as any);
        if (error) throw error;
      }
      toast.success("Added");
      setAddOpen(null);
      load();
    } catch (e: any) {
      toast.error(e.message ?? String(e));
      // A save can stop halfway (some obligations changed, one refused). Show
      // what is really saved, so the ticks in the dialog never disagree with it.
      if (addOpen === "tax") {
        const { data: fresh } = await supabase.from("client_tax_obligations").select("*").eq("client_id", id).eq("active", true);
        setObligations(fresh ?? []);
        setAddForm((f: any) => ({ ...f, return_types: (fresh ?? []).map((o: any) => o.tax_type) }));
        load();
      }
    } finally {
      setAddBusy(false);
    }
  }

  async function savePassword() {
    setPwdBusy(true);
    try {
      const { error } = await (supabase as any).rpc("set_client_portal_password", {
        _client_id: id,
        _password: pwdValue || null,
      });
      if (error) throw error;
      toast.success("Password updated");
      setEditPwd(false);
      setPwdValue("");
      load();
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setPwdBusy(false);
    }
  }


  const isIndividual = client?.client_type === "individual";
  const displayName = !client
    ? ""
    : isIndividual
    ? [client.first_name, client.last_name].filter(Boolean).join(" ") || client.company_name
    : client.company_name;
  return {
    navigate,
    isAdmin,
    client,
    setClient,
    tab,
    setTab,
    related,
    setRelated,
    taxPolicies,
    setTaxPolicies,
    obligations,
    setObligations,
    editOpen,
    setEditOpen,
    form,
    setForm,
    addOpen,
    setAddOpen,
    addForm,
    setAddForm,
    addBusy,
    setAddBusy,
    addFile,
    setAddFile,
    showPwd,
    setShowPwd,
    editPwd,
    setEditPwd,
    pwdValue,
    setPwdValue,
    pwdBusy,
    setPwdBusy,
    updaterName,
    setUpdaterName,
    recordUpdaterName,
    setRecordUpdaterName,
    load,
    openDocument,
    deleteClientDocument,
    setPaused,
    openEdit,
    saveEdit,
    deleteClient,
    deleteFilingRecord,
    openAdd,
    submitAdd,
    savePassword,
    isIndividual,
    displayName,
    id,
    search,
  };
}

export type ClientDetailCtx = ReturnType<typeof useClientDetail>;
