import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Download, Trash2, FileText, Eye, X, Search, FolderOpen } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useLiveRefresh } from "@/hooks/use-live-refresh";

export const Route = createFileRoute("/_authed/documents")({ component: DocsPage });

const CLIENT_DOCUMENT_CATEGORIES = [
  { value: "client_id", label: "Client ID / Passport" },
  { value: "cr12", label: "CR12 / Company Search" },
  { value: "kra_pin", label: "KRA PIN Certificate" },
  { value: "registration", label: "Registration / Incorporation Documents" },
  { value: "ownership", label: "Ownership / Director Supporting Documents" },
  { value: "bank_details", label: "Bank Details / Confirmation" },
  { value: "contract", label: "General Client Agreements" },
  { value: "client_supporting", label: "General Client Supporting Documents" },
  { value: "other", label: "Other Client Document" },
];
const SERVICE_LINES = [
  { value: "audit", label: "Audit" },
  { value: "advisory", label: "Advisory" },
  { value: "tax", label: "Tax" },
  { value: "ict", label: "ICT" },
  { value: "outsourced_accounting", label: "Outsourced Accounting" },
  { value: "payroll_management", label: "Payroll Management" },
  { value: "financial_business_management", label: "Financial & Business Management" },
];
const SERVICE_DOCUMENT_CATEGORIES = [
  { value: "audit_workpaper", label: "Audit working papers / evidence" },
  { value: "advisory_working_document", label: "Advisory case documents" },
  { value: "tax_document", label: "Tax returns, filings & receipts" },
  { value: "ict_document", label: "ICT service documents" },
  { value: "accounting_document", label: "Accounting records / schedules" },
  { value: "payroll_document", label: "Payroll records / statutory returns" },
  { value: "financial_management_document", label: "Financial & business management reports" },
  { value: "service_contract", label: "Service-specific contracts / correspondence" },
  { value: "other_service", label: "Other service document" },
];

function DocsPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [engagements, setEngagements] = useState<any[]>([]);
  const [clientId, setClientId] = useState("");
  const [filterClientId, setFilterClientId] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterScope, setFilterScope] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("client_supporting");
  const [documentScope, setDocumentScope] = useState("client_master");
  const [serviceLine, setServiceLine] = useState("audit");
  const [engagementId, setEngagementId] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  async function load() {
    const [d, aw, c, e] = await Promise.all([
      supabase.from("documents").select("*, clients(company_name), engagements(title, type)").order("created_at", { ascending: false }),
      supabase.from("audit_workpapers").select("*, engagements(id, client_id, title, type, clients(company_name))").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, company_name").order("company_name"),
      supabase.from("engagements").select("id, client_id, title, type").order("created_at", { ascending: false }),
    ]);
    if (d.error) toast.error(`Could not load documents: ${d.error.message}`);
    if (aw.error) toast.error(`Could not load audit documents: ${aw.error.message}`);
    if (c.error) toast.error(`Could not load clients: ${c.error.message}`);
    const clientDocuments = (d.data ?? []).map((r: any) => ({ ...r, source_table: "documents", storage_bucket: "client-documents" }));
    const auditDocuments = (aw.data ?? []).filter((r: any) => r.engagements?.client_id).map((r: any) => ({
      ...r,
      client_id: r.engagements.client_id,
      clients: r.engagements.clients,
      document_category: "audit_workpaper",
      document_scope: "service",
      service_line: "audit",
      audit_stage: r.category ?? "working_papers",
      source_table: "audit_workpapers",
      storage_bucket: "audit-workpapers",
    }));
    const advisoryResult = await supabase.from("advisory_milestone_documents" as any)
      .select("*, advisory_milestones(id, title, project_id, advisory_projects(id, client_id, title, service_type, clients(company_name)))")
      .order("created_at", { ascending: false });
    if (advisoryResult.error) toast.error(`Could not load advisory documents: ${advisoryResult.error.message}`);
    const advisoryDocuments = ((advisoryResult.data ?? []) as any[]).filter((r) => r.advisory_milestones?.advisory_projects?.client_id).map((r) => ({
      ...r,
      client_id: r.advisory_milestones.advisory_projects.client_id,
      clients: r.advisory_milestones.advisory_projects.clients,
      engagements: { title: `${r.advisory_milestones.advisory_projects.title} · ${r.advisory_milestones.title}` },
      document_category: "advisory_working_document",
      document_scope: "service",
      service_line: "advisory",
      source_table: "advisory_milestone_documents",
      storage_bucket: "client-documents",
    }));
    const serviceResult = await supabase.from("service_milestone_documents" as any)
      .select("*, service_milestones(id, title, project_id, service_projects(id, client_id, module, title, clients(company_name)))")
      .order("created_at", { ascending: false });
    if (serviceResult.error) toast.error(`Could not load service documents: ${serviceResult.error.message}`);
    const serviceDocuments = ((serviceResult.data ?? []) as any[]).filter((r) => r.service_milestones?.service_projects?.client_id).map((r) => {
      const project = r.service_milestones.service_projects;
      const line = project.module;
      return {
        ...r,
        client_id: project.client_id,
        clients: project.clients,
        engagements: { title: `${project.title} · ${r.service_milestones.title}` },
        document_category: line === "ict" ? "ict_document" : line === "payroll_management" ? "payroll_document" : line === "financial_business_management" ? "financial_management_document" : "accounting_document",
        document_scope: "service",
        service_line: line,
        source_table: "service_milestone_documents",
        storage_bucket: "client-documents",
      };
    });
    const normalizedClientDocuments = clientDocuments.map((r: any) => ({
      ...r,
      document_scope: r.document_scope ?? (r.tax_return_id ? "service" : "client_master"),
      service_line: r.service_line ?? (r.tax_return_id ? "tax" : null),
      document_category: r.document_category ?? (r.tax_return_id ? "tax_document" : "other"),
      engagements: r.engagements ?? null,
    }));
    setRows([...normalizedClientDocuments, ...auditDocuments, ...advisoryDocuments, ...serviceDocuments].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setClients(c.data ?? []);
    setEngagements(e.data ?? []);
  }
  useEffect(() => { void load(); }, []);
  useLiveRefresh(["documents", "clients", "engagements", "audit_workpapers", "advisory_milestone_documents", "service_milestone_documents"], load);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterClientId && r.client_id !== filterClientId) return false;
      if (filterScope && (r.document_scope ?? "client_master") !== filterScope) return false;
      if (filterCategory && (r.document_category ?? "other") !== filterCategory) return false;
      if (needle && !`${r.title ?? ""} ${r.clients?.company_name ?? ""} ${r.engagements?.title ?? ""} ${SERVICE_LINES.find((s) => s.value === r.service_line)?.label ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, filterClientId, filterScope, filterCategory, search]);

  const clientEngagements = engagements.filter((e) => e.client_id === clientId);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!clientId) { toast.error("Pick a client first"); e.target.value = ""; return; }
    if (documentScope === "service" && !serviceLine) { toast.error("Choose the service line for this document"); e.target.value = ""; return; }
    if (documentScope === "service" && serviceLine === "audit" && engagementId && !clientEngagements.some((eng) => eng.id === engagementId && eng.type === "audit")) {
      toast.error("Choose an audit engagement belonging to the selected client"); return;
    }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const path = `${clientId}/${documentScope}/${documentScope === "service" ? serviceLine : "client-records"}/${category}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("client-documents").upload(path, file);
    if (up.error) { toast.error(up.error.message); setBusy(false); e.target.value = ""; return; }
    const { error } = await supabase.from("documents").insert({
      client_id: clientId,
      engagement_id: documentScope === "service" && serviceLine === "audit" ? (engagementId || null) : null,
      document_category: category,
      document_scope: documentScope,
      service_line: documentScope === "service" ? serviceLine : null,
      title: title.trim() || file.name,
      file_path: path,
      uploaded_by: user?.id,
    } as any);
    setBusy(false);
    e.target.value = "";
    if (error) {
      await supabase.storage.from("client-documents").remove([path]);
      toast.error(error.message);
    } else {
      toast.success("Document uploaded and linked to client");
      setTitle("");
      setEngagementId("");
      await load();
    }
  }

  async function download(path: string, bucket = "client-documents") {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
    if (error) toast.error(error.message);
    else window.open(data.signedUrl, "_blank");
  }
  async function view(path: string, title: string, bucket = "client-documents") {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 600);
    if (error) toast.error(error.message);
    else setPreview({ url: data.signedUrl, title });
  }

  async function remove(id: string, path: string) {
    if (!confirm("Delete this document?")) return;
    const row = rows.find((r) => r.id === id && r.file_path === path);
    if (!row) { toast.error("Document record could not be found; refresh and try again"); return; }
    const { error: storageError } = await supabase.storage.from(row.storage_bucket ?? "client-documents").remove([path]);
    if (storageError) { toast.error(`Could not delete stored file: ${storageError.message}`); return; }
    const table = row.source_table === "audit_workpapers" ? "audit_workpapers" : row.source_table === "advisory_milestone_documents" ? "advisory_milestone_documents" : row.source_table === "service_milestone_documents" ? "service_milestone_documents" : "documents";
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); await load(); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-sm text-muted-foreground">Separate reusable client records from documents belonging to a specific service. Every document is linked to its client.</p>
      </div>

      <div className="bg-card border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-sm"><Upload className="h-4 w-4" /> Upload and link a document</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <select value={documentScope} onChange={e => { const next = e.target.value; setDocumentScope(next); setCategory(next === "client_master" ? "client_supporting" : serviceLine === "audit" ? "audit_workpaper" : serviceLine === "advisory" ? "advisory_working_document" : serviceLine === "tax" ? "tax_document" : serviceLine === "ict" ? "ict_document" : serviceLine === "payroll_management" ? "payroll_document" : serviceLine === "financial_business_management" ? "financial_management_document" : "accounting_document"); setEngagementId(""); }} className="h-9 px-3 rounded-md border bg-background text-sm" aria-label="Document location">
            <option value="client_master">Client Master Documents (reusable)</option><option value="service">Service-specific Documents</option>
          </select>
          <select value={clientId} onChange={e => { setClientId(e.target.value); setEngagementId(""); }} className="h-9 px-3 rounded-md border bg-background text-sm" aria-label="Client">
            <option value="">Select client…</option>{clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
          {documentScope === "service" && <select value={serviceLine} onChange={e => { const next = e.target.value; setServiceLine(next); setEngagementId(""); setCategory(next === "audit" ? "audit_workpaper" : next === "advisory" ? "advisory_working_document" : next === "tax" ? "tax_document" : next === "ict" ? "ict_document" : next === "payroll_management" ? "payroll_document" : next === "financial_business_management" ? "financial_management_document" : "accounting_document"); }} className="h-9 px-3 rounded-md border bg-background text-sm" aria-label="Service line">
            {SERVICE_LINES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>}
          <select value={category} onChange={e => { setCategory(e.target.value); setEngagementId(""); }} className="h-9 px-3 rounded-md border bg-background text-sm" aria-label="Document category">
            {(documentScope === "client_master" ? CLIENT_DOCUMENT_CATEGORIES : SERVICE_DOCUMENT_CATEGORIES).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input placeholder="Document title (optional)" value={title} onChange={e => setTitle(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm" />
          <label className={`h-9 inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm cursor-pointer ${busy ? "opacity-60" : ""}`}>
            <Upload className="h-4 w-4" /> {busy ? "Uploading…" : "Choose file & upload"}
            <input type="file" hidden onChange={upload} disabled={busy || !clientId} />
          </label>
        </div>
        {documentScope === "client_master" && <p className="text-xs text-muted-foreground">Use this section for identity, CR12, KRA PIN and other core client records that may support multiple services. These records are kept separate from service files.</p>}
        {documentScope === "service" && serviceLine === "audit" && (
          <div className="grid sm:grid-cols-2 gap-2">
            <select value={engagementId} onChange={e => setEngagementId(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm" aria-label="Audit engagement">
              <option value="">Link to an audit engagement (optional)</option>
              {clientEngagements.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            <p className="text-xs text-muted-foreground self-center">Audit documents remain linked to the selected client; linking an engagement helps locate them in the relevant audit.</p>
          </div>
        )}
      </div>

      <div className="bg-card border rounded-lg p-3 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-sm"><FolderOpen className="h-4 w-4" /> Find documents</div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setFilterScope("client_master")} className="px-3 py-1.5 rounded-md border text-xs">Client Master Documents</button>
          <button type="button" onClick={() => setFilterScope("service")} className="px-3 py-1.5 rounded-md border text-xs">Service Documents</button>
          <button type="button" onClick={() => setFilterScope("")} className="px-3 py-1.5 rounded-md border text-xs">All Documents</button>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input placeholder="Search title, client or audit…" value={search} onChange={e => setSearch(e.target.value)} className="h-9 w-full pl-9 pr-3 rounded-md border bg-background text-sm" />
          </div>
          <select value={filterClientId} onChange={e => setFilterClientId(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm" aria-label="Filter by client">
            <option value="">All clients</option>{clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm" aria-label="Filter by category">
            <option value="">All document categories</option>{[...CLIENT_DOCUMENT_CATEGORIES, ...SERVICE_DOCUMENT_CATEGORIES].filter((c, i, a) => a.findIndex(x => x.value === c.value) === i).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="text-xs text-muted-foreground">Showing {filteredRows.length} of {rows.length} documents</div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs text-muted-foreground border-b">
              <tr><th className="py-2 px-3">Document</th><th className="py-2 px-3">Document group</th><th className="py-2 px-3">Category</th><th className="py-2 px-3">Client</th><th className="py-2 px-3">Service / engagement</th><th className="py-2 px-3">Version</th><th className="py-2 px-3">Uploaded</th><th className="py-2 px-3"></th></tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-muted-foreground">No matching documents. Choose a client and category when uploading, or adjust your filters.</td></tr>}
              {filteredRows.map(r => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 align-top">
                  <td className="py-2 px-3"><div className="flex items-start gap-2 min-w-40"><FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" /><span className="break-words">{r.title}</span></div></td>
                  <td className="py-2 px-3"><span className={`inline-flex rounded-md px-2 py-1 text-xs ${r.document_scope === "service" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"}`}>{r.document_scope === "service" ? "Service file" : "Client master"}</span></td>
                  <td className="py-2 px-3"><span className="inline-flex rounded-md bg-muted px-2 py-1 text-xs">{[...CLIENT_DOCUMENT_CATEGORIES, ...SERVICE_DOCUMENT_CATEGORIES].find(c => c.value === (r.document_category ?? "other"))?.label ?? "Other"}{r.source_table === "audit_workpapers" && r.audit_stage ? ` · ${String(r.audit_stage).replaceAll("_", " ")}` : ""}</span></td>
                  <td className="py-2 px-3">{r.clients?.company_name ?? "Unlinked client"}</td>
                  <td className="py-2 px-3 text-xs">{SERVICE_LINES.find(s => s.value === r.service_line)?.label ?? (r.source_table === "audit_workpapers" ? "Audit" : r.source_table === "advisory_milestone_documents" ? "Advisory" : "—")}{r.engagements?.title ? <div className="text-muted-foreground">{r.engagements.title}</div> : null}</td>
                  <td className="py-2 px-3">v{r.version}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(r.created_at)}
                    {r.updated_at && new Date(r.updated_at).getTime() - new Date(r.created_at).getTime() > 60000 && <div className="text-[10px]">Edited {formatDateTime(r.updated_at)}</div>}
                  </td>
                  <td className="py-2 px-3 text-right space-x-2 whitespace-nowrap">
                    <button onClick={() => view(r.file_path, r.title, r.storage_bucket ?? "client-documents")} className="text-primary text-xs inline-flex items-center gap-1"><Eye className="h-3 w-3" />View</button>
                    <button onClick={() => download(r.file_path, r.storage_bucket ?? "client-documents")} className="text-primary text-xs inline-flex items-center gap-1"><Download className="h-3 w-3" />Download</button>
                    {isAdmin && <button onClick={() => remove(r.id, r.file_path)} className="text-destructive text-xs inline-flex items-center gap-1"><Trash2 className="h-3 w-3" />Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-card w-full max-w-5xl h-[90vh] rounded-lg flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-3 border-b">
              <div className="font-semibold text-sm truncate">{preview.title}</div>
              <div className="flex items-center gap-2">
                <a href={preview.url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1"><Download className="h-3 w-3" />Open in new tab</a>
                <button onClick={() => setPreview(null)}><X className="h-4 w-4" /></button>
              </div>
            </div>
            <iframe src={preview.url} className="flex-1 w-full" title={preview.title} />
          </div>
        </div>
      )}
    </div>
  );
}
