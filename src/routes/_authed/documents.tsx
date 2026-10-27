import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Download, Trash2, FileText, Eye, X, Search, FolderOpen, ShieldCheck, CalendarClock, Link2 } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { isOnline } from "@/lib/offline/status";

export const Route = createFileRoute("/_authed/documents")({ component: DocsPage });

type DocumentGroup = "client_master" | "service";
type ServiceLine = "audit" | "advisory" | "tax" | "ict" | "outsourced_accounting" | "payroll_management" | "financial_business_management";
type LibraryDocument = {
  id: string;
  sourceId: string;
  title: string;
  clientId: string;
  clientName: string;
  group: DocumentGroup;
  serviceLine: string | null;
  category: string;
  bucket: string;
  filePath: string;
  createdAt: string;
  updatedAt?: string | null;
  version?: number | null;
  periodLabel?: string | null;
  expiresOn?: string | null;
  confidentiality?: string | null;
  origin: string;
  canDelete: boolean;
};

const SERVICES: { value: ServiceLine; label: string }[] = [
  { value: "audit", label: "Audit" },
  { value: "advisory", label: "Advisory" },
  { value: "tax", label: "Tax" },
  { value: "ict", label: "ICT" },
  { value: "outsourced_accounting", label: "Outsourced Accounting" },
  { value: "payroll_management", label: "Payroll Management" },
  { value: "financial_business_management", label: "Financial & Business Management" },
];
const MASTER_CATEGORIES = [
  ["identity", "ID / Passport"], ["company_search", "CR12 / Company Search"],
  ["kra_pin", "KRA PIN Certificate"], ["incorporation", "Incorporation / Registration"],
  ["ownership", "Directors / Ownership Documents"], ["banking", "Bank Details / Confirmation"],
  ["general_supporting", "General Supporting Document"],
] as const;
const SERVICE_CATEGORIES: Record<ServiceLine, readonly (readonly [string, string])[]> = {
  audit: [["audit_evidence", "Audit Evidence"], ["working_papers", "Working Papers"], ["financial_statements", "Financial Statements"], ["audit_report", "Audit Report"], ["confirmation", "Confirmations"], ["other_service", "Other Audit Document"]],
  advisory: [["advisory_assignment", "Assignment / Brief"], ["advisory_analysis", "Research / Analysis"], ["advisory_deliverable", "Recommendations / Deliverable"], ["other_service", "Other Advisory Document"]],
  tax: [["tax_filing", "Tax Return / Filing"], ["tax_receipt", "Filing Receipt / Acknowledgement"], ["tax_computation", "Tax Computation"], ["tax_assessment", "Assessment / Notice"], ["other_service", "Other Tax Document"]],
  ict: [["ict_project", "ICT Project Document"], ["ict_support", "Support / Configuration Record"], ["ict_handover", "Handover / User Guide"], ["other_service", "Other ICT Document"]],
  outsourced_accounting: [["ledger", "Ledger / Trial Balance"], ["reconciliation", "Reconciliation / Schedule"], ["accounting_report", "Accounting Report"], ["other_service", "Other Accounting Document"]],
  payroll_management: [["payroll_report", "Payroll Report"], ["payslip", "Payslip / Payroll Output"], ["payroll_statutory", "Statutory Submission"], ["other_service", "Other Payroll Document"]],
  financial_business_management: [["management_report", "Management Report"], ["budget", "Budget / Forecast"], ["cashflow", "Cash Flow / Financial Analysis"], ["other_service", "Other Financial & Business Management Document"]],
};
const SERVICE_LABEL: Record<string, string> = Object.fromEntries(SERVICES.map((s) => [s.value, s.label]));
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries([
  ...MASTER_CATEGORIES,
  ...Object.values(SERVICE_CATEGORIES).flat(),
].map(([value, label]) => [value, label]));
const inputClass = "h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm";

function DocsPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<LibraryDocument[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [engagements, setEngagements] = useState<any[]>([]);
  const [taxReturns, setTaxReturns] = useState<any[]>([]);
  const [advisoryProjects, setAdvisoryProjects] = useState<any[]>([]);
  const [serviceProjects, setServiceProjects] = useState<any[]>([]);
  const [clientId, setClientId] = useState("");
  const [documentGroup, setDocumentGroup] = useState<DocumentGroup>("client_master");
  const [serviceLine, setServiceLine] = useState<ServiceLine | "">("");
  const [category, setCategory] = useState("identity");
  const [relatedRecord, setRelatedRecord] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [confidentiality, setConfidentiality] = useState("confidential");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);
  const [tab, setTab] = useState<"all" | DocumentGroup>("all");
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterService, setFilterService] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  async function load() {
    const [docsRes, clientsRes, engagementsRes, taxRes, advisoryProjectsRes, advisoryMilestonesRes, advisoryDocsRes, serviceProjectsRes, serviceMilestonesRes, serviceDocsRes, auditDocsRes] = await Promise.all([
      supabase.from("documents").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, company_name").order("company_name"),
      supabase.from("engagements").select("id, client_id, title, type").order("created_at", { ascending: false }),
      supabase.from("tax_returns").select("id, client_id, return_type, period_start, period_end").order("created_at", { ascending: false }),
      supabase.from("advisory_projects").select("id, client_id, title"),
      supabase.from("advisory_milestones").select("id, project_id, title"),
      supabase.from("advisory_milestone_documents").select("*"),
      supabase.from("service_projects").select("id, client_id, module, title"),
      supabase.from("service_milestones").select("id, project_id, title"),
      supabase.from("service_milestone_documents").select("*"),
      supabase.from("audit_workpapers").select("*"),
    ]);
    if (docsRes.error) toast.error(`Could not load central documents: ${docsRes.error.message}`);
    const clientRows = clientsRes.data ?? [];
    const clientMap = new Map<string, string>(clientRows.map((c: any): [string, string] => [c.id, c.company_name || "Unnamed client"]));
    const engagementRows = engagementsRes.data ?? [];
    const taxRows = taxRes.data ?? [];
    const advisoryProjectRows = advisoryProjectsRes.data ?? [];
    const advisoryMilestoneRows = advisoryMilestonesRes.data ?? [];
    const serviceProjectRows = serviceProjectsRes.data ?? [];
    const serviceMilestoneRows = serviceMilestonesRes.data ?? [];
    setClients(clientRows);
    setEngagements(engagementRows);
    setTaxReturns(taxRows);
    setAdvisoryProjects(advisoryProjectRows);
    setServiceProjects(serviceProjectRows);

    const engagementMap = new Map<string, any>(engagementRows.map((e: any): [string, any] => [e.id, e]));
    const normalized: LibraryDocument[] = (docsRes.data ?? []).map((r: any) => {
      const linkedEngagement: any = r.engagement_id ? engagementMap.get(r.engagement_id) : null;
      const linkedService = r.service_line ?? (r.tax_return_id ? "tax" : linkedEngagement?.type ?? null);
      const fallbackCategory = r.tax_return_id ? "tax_filing" : linkedEngagement?.type === "tax" ? "tax_filing" : linkedEngagement?.type === "advisory" ? "advisory_assignment" : linkedEngagement ? "audit_evidence" : "general_supporting";
      return ({
      id: r.id, sourceId: r.id, title: r.title, clientId: r.client_id ?? "", clientName: clientMap.get(r.client_id) ?? "Client not linked",
      group: r.document_group === "service" || r.tax_return_id || r.engagement_id ? "service" : "client_master",
      serviceLine: linkedService,
      category: r.category ?? fallbackCategory,
      bucket: r.storage_bucket || "client-documents", filePath: r.file_path, createdAt: r.created_at,
      updatedAt: r.updated_at, version: r.version, periodLabel: r.period_label, expiresOn: r.expires_on,
      confidentiality: r.confidentiality ?? "confidential", origin: "Central library", canDelete: true,
    });
    });

    for (const r of auditDocsRes.data ?? []) {
      const e: any = engagementMap.get(r.engagement_id);
      if (!e || !r.file_path) continue;
      normalized.push({ id: `audit:${r.id}`, sourceId: r.id, title: r.title, clientId: e.client_id, clientName: clientMap.get(e.client_id) ?? "Client not linked", group: "service", serviceLine: "audit", category: r.category || "working_papers", bucket: "audit-workpapers", filePath: r.file_path, createdAt: r.created_at, version: r.version, periodLabel: null, expiresOn: null, confidentiality: "confidential", origin: `Audit · ${e.title}`, canDelete: false });
    }

    const advisoryProjectMap = new Map<string, any>(advisoryProjectRows.map((p: any): [string, any] => [p.id, p]));
    const advisoryMilestoneMap = new Map<string, any>(advisoryMilestoneRows.map((m: any): [string, any] => [m.id, m]));
    for (const r of advisoryDocsRes.data ?? []) {
      const milestone: any = advisoryMilestoneMap.get(r.milestone_id);
      const project: any = milestone ? advisoryProjectMap.get(milestone.project_id) : null;
      if (!project || !r.file_path) continue;
      normalized.push({ id: `advisory:${r.id}`, sourceId: r.id, title: r.title, clientId: project.client_id, clientName: clientMap.get(project.client_id) ?? "Client not linked", group: "service", serviceLine: "advisory", category: "advisory_deliverable", bucket: "client-documents", filePath: r.file_path, createdAt: r.created_at, periodLabel: null, expiresOn: null, confidentiality: "confidential", origin: `Advisory · ${project.title}${milestone?.title ? ` · ${milestone.title}` : ""}`, canDelete: false });
    }

    const serviceProjectMap = new Map<string, any>(serviceProjectRows.map((p: any): [string, any] => [p.id, p]));
    const serviceMilestoneMap = new Map<string, any>(serviceMilestoneRows.map((m: any): [string, any] => [m.id, m]));
    for (const r of serviceDocsRes.data ?? []) {
      const milestone: any = serviceMilestoneMap.get(r.milestone_id);
      const project: any = milestone ? serviceProjectMap.get(milestone.project_id) : null;
      if (!project || !r.file_path) continue;
      normalized.push({ id: `service:${r.id}`, sourceId: r.id, title: r.title, clientId: project.client_id, clientName: clientMap.get(project.client_id) ?? "Client not linked", group: "service", serviceLine: project.module, category: "other_service", bucket: "client-documents", filePath: r.file_path, createdAt: r.created_at, periodLabel: null, expiresOn: null, confidentiality: "confidential", origin: `${SERVICE_LABEL[project.module] ?? project.module} · ${project.title}${milestone?.title ? ` · ${milestone.title}` : ""}`, canDelete: false });
    }
    normalized.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setRows(normalized);
  }

  useEffect(() => { void load(); }, []);
  useLiveRefresh(["documents", "clients", "audit_workpapers", "advisory_milestone_documents", "service_milestone_documents"], load);

  const categoryOptions = documentGroup === "client_master" ? MASTER_CATEGORIES : serviceLine ? SERVICE_CATEGORIES[serviceLine] : [];
  const availableRelatedRecords = useMemo(() => {
    if (documentGroup !== "service" || !serviceLine || !clientId) return [] as { value: string; label: string }[];
    if (serviceLine === "audit") return engagements.filter((r) => r.client_id === clientId).map((r) => ({ value: `engagement:${r.id}`, label: r.title || r.type || "Audit engagement" }));
    if (serviceLine === "tax") return taxReturns.filter((r) => r.client_id === clientId).map((r) => ({ value: `tax:${r.id}`, label: `${r.return_type}${r.period_end ? ` · ${r.period_end}` : ""}` }));
    if (serviceLine === "advisory") return advisoryProjects.filter((r) => r.client_id === clientId).map((r) => ({ value: `advisory:${r.id}`, label: r.title }));
    return serviceProjects.filter((r) => r.client_id === clientId && r.module === serviceLine).map((r) => ({ value: `service:${r.id}`, label: r.title }));
  }, [documentGroup, serviceLine, clientId, engagements, taxReturns, advisoryProjects, serviceProjects]);

  function requireOnline(action: string) {
    if (typeof navigator !== "undefined" && (!navigator.onLine || !isOnline())) {
      toast.error(`${action} requires an active internet connection. Reconnect and try again.`);
      return false;
    }
    return true;
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (busy) { input.value = ""; return; }
    if (!requireOnline("Document uploads")) { input.value = ""; return; }
    if (!clientId) { toast.error("Select a client first"); input.value = ""; return; }
    if (documentGroup === "service" && !serviceLine) { toast.error("Select the service line"); input.value = ""; return; }
    if (!category) { toast.error("Select a document category"); input.value = ""; return; }
    setBusy(true);
    let path: string | null = null;
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { toast.error(authError?.message || "Sign in again before uploading documents."); return; }
      const [relationType, relationId] = relatedRecord ? relatedRecord.split(":") : ["", ""];
      const safeName = file.name.replace(/[\\/]/g, "_");
      const uniqueName = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      path = relationType === "tax" && relationId
        ? `${clientId}/tax-returns/${relationId}/${uniqueName}-${safeName}`
        : `${clientId}/${documentGroup}/${serviceLine || "client-master"}/${uniqueName}-${safeName}`;
      const up = await supabase.storage.from("client-documents").upload(path, file, { upsert: false });
      if (up.error) { toast.error(up.error.message); return; }
      if (!requireOnline("Saving document details")) {
        toast.error("The file was uploaded, but its record was not saved. Reconnect before continuing; the file has been retained to avoid deleting a possibly linked document.");
        return;
      }
      const payload: Record<string, any> = {
        client_id: clientId, title: title.trim() || file.name, file_path: path, uploaded_by: user.id,
        document_group: documentGroup, service_line: documentGroup === "service" ? serviceLine : null,
        category, storage_bucket: "client-documents", period_label: periodLabel.trim() || null,
        expires_on: expiresOn || null, confidentiality,
        engagement_id: relationType === "engagement" ? relationId : null,
        tax_return_id: relationType === "tax" ? relationId : null,
        advisory_project_id: relationType === "advisory" ? relationId : null,
        service_project_id: relationType === "service" ? relationId : null,
      };
      const { error } = await supabase.from("documents").insert(payload as any);
      if (error) {
        // A connection can fail after the server committed the insert. Check the unique
        // storage path before cleanup so we never delete a file that has a saved record.
        const check = await supabase.from("documents").select("id").eq("file_path", path).maybeSingle();
        if (check.data?.id) {
          toast.success("Document uploaded and linked to the client");
          setTitle(""); setPeriodLabel(""); setExpiresOn(""); setRelatedRecord("");
          await load();
        } else if (!check.error) {
          const cleanup = await supabase.storage.from("client-documents").remove([path]);
          toast.error(cleanup.error ? `Document details were not saved (${error.message}); the uploaded file could not be cleaned up (${cleanup.error.message}).` : error.message);
        } else {
          toast.error("The save result could not be confirmed. The uploaded file was retained to avoid breaking a record that may have been saved; refresh the library before retrying.");
        }
      } else {
        toast.success("Document uploaded and linked to the client");
        setTitle(""); setPeriodLabel(""); setExpiresOn(""); setRelatedRecord("");
        await load();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Document upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      input.value = "";
    }
  }

  async function signedUrl(row: LibraryDocument, seconds: number) {
    if (!requireOnline("Viewing or downloading documents")) return null;
    try {
      const { data, error } = await supabase.storage.from(row.bucket).createSignedUrl(row.filePath, seconds);
      if (error) { toast.error(error.message); return null; }
      return data.signedUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the document. Check your connection.");
      return null;
    }
  }
  async function download(row: LibraryDocument) {
    const url = await signedUrl(row, 60);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }
  async function view(row: LibraryDocument) {
    const url = await signedUrl(row, 600);
    if (url) setPreview({ url, title: row.title });
  }
  async function remove(row: LibraryDocument) {
    if (!row.canDelete || !confirm("Delete this document and its stored file? This cannot be undone.")) return;
    if (!requireOnline("Document deletion")) return;
    try {
      const { error: storageError } = await supabase.storage.from(row.bucket).remove([row.filePath]);
      if (storageError) { toast.error(`File was not deleted: ${storageError.message}`); return; }
      const { error } = await supabase.from("documents").delete().eq("id", row.sourceId);
      if (error) toast.error(`The file was removed, but its database record could not be deleted: ${error.message}`);
      else { toast.success("Document deleted"); await load(); }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Document deletion failed. Check your connection.");
    }
  }

  const filteredRows = rows.filter((r) => {
    if (tab !== "all" && r.group !== tab) return false;
    if (filterClient && r.clientId !== filterClient) return false;
    if (filterService !== "all" && r.serviceLine !== filterService) return false;
    if (filterCategory !== "all" && r.category !== filterCategory) return false;
    const haystack = `${r.title} ${r.clientName} ${r.origin} ${r.category} ${r.periodLabel ?? ""}`.toLowerCase();
    return !search.trim() || haystack.includes(search.trim().toLowerCase());
  });
  const filteredCategories = [...new Set(rows.filter((r) => tab === "all" || r.group === tab).map((r) => r.category))].sort();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-sm text-muted-foreground">One client-linked library, separating reusable client records from service workpapers and deliverables.</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Private files use time-limited access links</div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button onClick={() => setTab("all")} className={`rounded-lg border p-3 text-left ${tab === "all" ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/30"}`}><span className="text-xs text-muted-foreground">All records</span><div className="mt-1 text-xl font-semibold">{rows.length}</div></button>
        <button onClick={() => setTab("client_master")} className={`rounded-lg border p-3 text-left ${tab === "client_master" ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/30"}`}><span className="flex items-center gap-2 text-xs text-muted-foreground"><FolderOpen className="h-3.5 w-3.5" /> Client Master Documents</span><div className="mt-1 text-xl font-semibold">{rows.filter((r) => r.group === "client_master").length}</div></button>
        <button onClick={() => setTab("service")} className={`rounded-lg border p-3 text-left ${tab === "service" ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/30"}`}><span className="flex items-center gap-2 text-xs text-muted-foreground"><Link2 className="h-3.5 w-3.5" /> Service Documents</span><div className="mt-1 text-xl font-semibold">{rows.filter((r) => r.group === "service").length}</div></button>
      </div>

      <section className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Upload a document</h2><span className="text-xs text-muted-foreground">Client linkage is required</span></div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select value={clientId} onChange={(e) => { setClientId(e.target.value); setRelatedRecord(""); }} className={inputClass}><option value="">Select client…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}</select>
          <select value={documentGroup} onChange={(e) => { const next = e.target.value as DocumentGroup; setDocumentGroup(next); setServiceLine(""); setRelatedRecord(""); setCategory(next === "client_master" ? "identity" : ""); }} className={inputClass}><option value="client_master">Client Master Document</option><option value="service">Service Document</option></select>
          <select value={serviceLine} onChange={(e) => { setServiceLine(e.target.value as ServiceLine | ""); setRelatedRecord(""); setCategory(""); }} disabled={documentGroup !== "service"} className={`${inputClass} disabled:opacity-50`}><option value="">Select service…</option>{SERVICES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}><option value="">Select category…</option>{categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title (optional)" className={inputClass} />
          <select value={relatedRecord} onChange={(e) => setRelatedRecord(e.target.value)} disabled={!availableRelatedRecords.length} className={`${inputClass} disabled:opacity-50`}><option value="">Link to specific work item (optional)</option>{availableRelatedRecords.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
          <input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="Period / year (optional)" className={inputClass} />
          <div className="grid grid-cols-2 gap-2"><input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} title="Expiry or review date" className={inputClass} /><select value={confidentiality} onChange={(e) => setConfidentiality(e.target.value)} className={inputClass}><option value="confidential">Confidential</option><option value="restricted">Restricted</option></select></div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">Master documents are reusable client records. Service documents stay categorized by service; linking to a work item is optional. Restricted files are visible only to director/admin.</p>
          <label className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm text-primary-foreground ${busy || !clientId ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}><Upload className="h-4 w-4" />{busy ? "Uploading…" : "Choose file & upload"}<input type="file" hidden onChange={upload} disabled={busy || !clientId} /></label>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, client or work item…" className={`${inputClass} pl-9`} /></div>
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className={inputClass}><option value="">All clients</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}</select>
          <select value={filterService} onChange={(e) => setFilterService(e.target.value)} className={inputClass}><option value="all">All services</option>{SERVICES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={inputClass}><option value="all">All categories</option>{filteredCategories.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c] ?? c.replaceAll("_", " ")}</option>)}</select>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>Showing {filteredRows.length} of {rows.length} documents</span><span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Expiry dates are shown where recorded</span></div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2">Document</th><th className="px-3 py-2">Client</th><th className="px-3 py-2">Group / Service</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Period</th><th className="px-3 py-2">Expiry / review</th><th className="px-3 py-2">Uploaded</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
            <tbody>
              {filteredRows.length === 0 && <tr><td colSpan={8} className="px-3 py-12 text-center text-muted-foreground">No documents match these filters.</td></tr>}
              {filteredRows.map((r) => <tr key={r.id} className="border-t align-top hover:bg-muted/20">
                <td className="max-w-[260px] px-3 py-2"><div className="flex items-start gap-2"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><div className="break-words font-medium">{r.title}</div><div className="mt-0.5 break-words text-[11px] text-muted-foreground">{r.origin}{r.version ? ` · v${r.version}` : ""}</div>{r.confidentiality === "restricted" && <span className="mt-1 inline-block rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700">Restricted</span>}</div></div></td>
                <td className="max-w-[180px] whitespace-normal break-words px-3 py-2">{r.clientName}</td>
                <td className="px-3 py-2"><span className={`inline-block rounded-full px-2 py-1 text-[11px] ${r.group === "client_master" ? "bg-blue-500/10 text-blue-700" : "bg-violet-500/10 text-violet-700"}`}>{r.group === "client_master" ? "Client Master" : SERVICE_LABEL[r.serviceLine ?? ""] ?? "Service"}</span></td>
                <td className="max-w-[190px] whitespace-normal break-words px-3 py-2">{CATEGORY_LABEL[r.category] ?? r.category.replaceAll("_", " ")}</td>
                <td className="px-3 py-2">{r.periodLabel || "—"}</td>
                <td className="px-3 py-2">{r.expiresOn ? formatDate(r.expiresOn) : "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDate(r.createdAt)}{r.updatedAt && new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime() > 60000 && <div className="text-[10px]">Edited {formatDateTime(r.updatedAt)}</div>}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right"><div className="inline-flex items-center gap-3"><button onClick={() => void view(r)} className="inline-flex items-center gap-1 text-xs text-primary"><Eye className="h-3 w-3" />View</button><button onClick={() => void download(r)} className="inline-flex items-center gap-1 text-xs text-primary"><Download className="h-3 w-3" />Download</button>{isAdmin && r.canDelete && <button onClick={() => void remove(r)} aria-label={`Delete ${r.title}`} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}</div></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Documents originating in Audit, Advisory or service milestones are shown here by reference and should be managed from their originating service module. This avoids duplicate files and preserves existing workflows.</p>
      </section>

      {preview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}><div onClick={(e) => e.stopPropagation()} className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-card"><div className="flex items-center justify-between gap-3 border-b p-3"><div className="truncate text-sm font-semibold">{preview.title}</div><div className="flex items-center gap-3"><a href={preview.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary"><Download className="h-3 w-3" />Open in new tab</a><button onClick={() => setPreview(null)} aria-label="Close preview"><X className="h-4 w-4" /></button></div></div><iframe src={preview.url} className="w-full flex-1" title={preview.title} /></div></div>}
    </div>
  );
}
