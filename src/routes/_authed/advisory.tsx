import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authed/advisory")({
  head: () => ({
    meta: [
      { title: "Advisory | G.K Nahashon & Company" },
      {
        name: "description",
        content: "Manage BRS, CBK, company, financial and PBORA advisory cases.",
      },
    ],
  }),
  component: AdvisoryPage,
});

type ServiceKey = "brs" | "cbk" | "company" | "financial" | "pbora";
type CaseStatus = "not_started" | "in_progress" | "under_review" | "completed";

const SERVICES: Array<{
  key: ServiceKey;
  label: string;
  short: string;
  description: string;
  color: string;
  activities: string[];
}> = [
  {
    key: "brs",
    label: "Business Registration (BRS)",
    short: "BRS",
    color: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    description: "Company and business registry services, filings and changes.",
    activities: [
      "Identify BRS service and client objective",
      "Collect required client information and documents",
      "Prepare application / filing",
      "Submit through the applicable BRS channel",
      "Monitor registry response or query",
      "Resolve query / make corrections where required",
      "Receive and verify registry output",
      "Deliver final document / confirmation to client",
    ],
  },
  {
    key: "cbk",
    label: "Digital Credit Provider (CBK)",
    short: "CBK",
    color: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    description: "Regulatory licensing and advisory support for digital credit providers.",
    activities: [
      "Confirm applicable CBK licensing / regulatory route",
      "Assess business model and proposed credit activities",
      "Collect corporate, ownership and management information",
      "Collect governance, policies and supporting documents",
      "Review technology / ICT and data-protection documentation",
      "Prepare application and supporting pack",
      "Submit application / respond to regulator requests",
      "Track queries, rectifications and outstanding documents",
      "Receive and verify regulatory outcome / licence",
      "Complete client handover and post-licensing action list",
    ],
  },
  {
    key: "company",
    label: "Company Advisory",
    short: "Company",
    color: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    description: "Flexible advisory for a client's company problem or business decision.",
    activities: [],
  },
  {
    key: "financial",
    label: "Financial Advisory",
    short: "Financial",
    color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    description: "Dividends, financial analysis, modelling and financial consultancy.",
    activities: [],
  },
  {
    key: "pbora",
    label: "NGO / PBO (PBORA)",
    short: "PBORA",
    color: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    description: "PBO registration and post-registration support.",
    activities: [
      "Confirm applicable PBO / PBORA service",
      "Confirm name and proposed objectives",
      "Collect constitution and founding documents",
      "Collect officials / trustees / directors information",
      "Collect required identification, clearances and supporting documents",
      "Prepare application and supporting pack",
      "Submit application to PBORA",
      "Track review, queries and required corrections",
      "Receive and verify registration / regulatory output",
      "Complete client handover and post-registration actions",
    ],
  },
];

const STATUSES: Array<{ key: CaseStatus; label: string }> = [
  { key: "not_started", label: "Not started" },
  { key: "in_progress", label: "In progress" },
  { key: "under_review", label: "Under review" },
  { key: "completed", label: "Completed" },
];

const SERVICE_MAP = Object.fromEntries(SERVICES.map((s) => [s.key, s])) as Record<ServiceKey, (typeof SERVICES)[number]>;

function AdvisoryPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [query, setQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState<ServiceKey | "all">("all");
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "all">("all");
  const [showNew, setShowNew] = useState(false);
  const [newCase, setNewCase] = useState({ client_id: "", service: "brs" as ServiceKey, title: "", description: "" });
  const [editing, setEditing] = useState<any | null>(null);
  const [activityTitle, setActivityTitle] = useState("");
  const [activityDue, setActivityDue] = useState("");
  const [activityAssignee, setActivityAssignee] = useState("");
  const [activityNotes, setActivityNotes] = useState("");
  const [expandedActivity, setExpandedActivity] = useState<Record<string, boolean>>({});
  const [activityDocs, setActivityDocs] = useState<Record<string, any[]>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  async function load() {
    const [caseResult, clientResult, staffResult] = await Promise.all([
      supabase
        .from("advisory_projects")
        .select("id, client_id, title, description, start_date, due_date, status, stage, created_at, clients(company_name)")
        .order("created_at", { ascending: false }),
      supabase.from("clients").select("id, company_name").order("company_name"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
    ]);

    if (caseResult.error) toast.error(caseResult.error.message);
    if (clientResult.error) toast.error(clientResult.error.message);
    if (staffResult.error) toast.error(staffResult.error.message);
    setCases(caseResult.data ?? []);
    setClients(clientResult.data ?? []);
    setStaff(staffResult.data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  useLiveRefresh(["advisory_projects", "advisory_milestones", "advisory_milestone_documents"], load);

  const filteredCases = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases.filter((item) => {
      const service = (item.stage || "company") as ServiceKey;
      const matchesService = serviceFilter === "all" || service === serviceFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const text = `${item.title} ${item.description ?? ""} ${item.clients?.company_name ?? ""}`.toLowerCase();
      return matchesService && matchesStatus && (!q || text.includes(q));
    });
  }, [cases, query, serviceFilter, statusFilter]);

  async function openCase(item: any) {
    const { data, error } = await supabase
      .from("advisory_projects")
      .select("id, client_id, title, description, start_date, due_date, status, stage, created_at, clients(company_name), advisory_milestones(id, title, due_date, done, notes, assigned_to, completed_at)")
      .eq("id", item.id)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    setSelected(data);
  }

  async function createCase() {
    if (!newCase.client_id || !newCase.title.trim()) {
      toast.error("Client and case title are required.");
      return;
    }
    const template = SERVICE_MAP[newCase.service];
    const { data, error } = await supabase
      .from("advisory_projects")
      .insert({
        client_id: newCase.client_id,
        title: newCase.title.trim(),
        description: newCase.description.trim() || null,
        status: "not_started",
        stage: newCase.service,
        start_date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();

    if (error || !data) {
      toast.error(error?.message ?? "Unable to create advisory case.");
      return;
    }

    if (template.activities.length) {
      const { error: activityError } = await supabase.from("advisory_milestones").insert(
        template.activities.map((title) => ({ project_id: data.id, title, done: false, stage: null })),
      );
      if (activityError) toast.error(`Case created, but starter activities could not be added: ${activityError.message}`);
    }

    toast.success("Advisory case created.");
    setShowNew(false);
    setNewCase({ client_id: "", service: "brs", title: "", description: "" });
    await load();
    await openCase({ id: data.id });
  }

  async function updateCase(patch: Record<string, any>) {
    if (!selected) return;
    const { error } = await supabase.from("advisory_projects").update(patch).eq("id", selected.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Case updated.");
    await load();
    await openCase({ id: selected.id });
  }

  async function deleteCase(id: string) {
    if (!confirm("Delete this advisory case and its activities?")) return;
    const { error: activityError } = await supabase.from("advisory_milestones").delete().eq("project_id", id);
    if (activityError) {
      toast.error(activityError.message);
      return;
    }
    const { error } = await supabase.from("advisory_projects").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Case deleted.");
      setSelected(null);
      await load();
    }
  }

  async function addActivity() {
    if (!selected || !activityTitle.trim()) return;
    const { error } = await supabase.from("advisory_milestones").insert({
      project_id: selected.id,
      title: activityTitle.trim(),
      due_date: activityDue || null,
      assigned_to: activityAssignee || null,
      notes: activityNotes.trim() || null,
      done: false,
      stage: null,
    });
    if (error) toast.error(error.message);
    else {
      if (activityAssignee && activityAssignee !== user?.id) {
        await supabase.from("notifications").insert({
          user_id: activityAssignee,
          type: "advisory_activity_assigned",
          title: "Advisory activity assigned",
          body: `${activityTitle.trim()} — ${selected.clients?.company_name ?? selected.title}`,
          link: "/advisory",
        });
      }
      setActivityTitle("");
      setActivityDue("");
      setActivityAssignee("");
      setActivityNotes("");
      await openCase(selected);
    }
  }

  async function toggleActivity(activity: any) {
    const done = !activity.done;
    const { error } = await supabase.from("advisory_milestones").update({
      done,
      completed_at: done ? new Date().toISOString() : null,
    }).eq("id", activity.id);
    if (error) toast.error(error.message);
    else await openCase(selected);
  }

  async function deleteActivity(id: string) {
    if (!confirm("Delete this activity?")) return;
    const { error } = await supabase.from("advisory_milestones").delete().eq("id", id);
    if (error) toast.error(error.message);
    else await openCase(selected);
  }

  async function loadDocs(activityId: string) {
    const { data, error } = await supabase
      .from("advisory_milestone_documents" as any)
      .select("*")
      .eq("milestone_id", activityId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setActivityDocs((prev) => ({ ...prev, [activityId]: data ?? [] }));
  }

  async function uploadDocument(activityId: string, file: File) {
    if (!selected) return;
    setUploading(activityId);
    try {
      const path = `advisory/${selected.id}/${activityId}/${Date.now()}-${file.name}`;
      const upload = await supabase.storage.from("client-documents").upload(path, file);
      if (upload.error) throw upload.error;
      const { error } = await supabase.from("advisory_milestone_documents" as any).insert({
        milestone_id: activityId,
        title: file.name,
        file_path: path,
        uploaded_by: user?.id ?? null,
      });
      if (error) throw error;
      await loadDocs(activityId);
      toast.success("Document uploaded.");
    } catch (error: any) {
      toast.error(error.message ?? "Upload failed.");
    } finally {
      setUploading(null);
    }
  }

  async function openDocument(path: string) {
    const { data, error } = await supabase.storage.from("client-documents").createSignedUrl(path, 600);
    if (error) toast.error(error.message);
    else window.open(data.signedUrl, "_blank");
  }

  const serviceCounts = SERVICES.map((service) => ({
    ...service,
    count: cases.filter((item) => (item.stage || "company") === service.key).length,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Advisory</h1>
          <p className="text-sm text-muted-foreground">Client cases, activities and regulatory work — without forced project stages.</p>
        </div>
        <button onClick={() => setShowNew(true)} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> New advisory case
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {serviceCounts.map((service) => (
          <button key={service.key} onClick={() => setServiceFilter(serviceFilter === service.key ? "all" : service.key)} className={`text-left rounded-lg border p-3 transition ${serviceFilter === service.key ? "border-primary ring-1 ring-primary/20" : "hover:border-primary/40"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${service.color}`}>{service.short}</span>
              <span className="font-semibold">{service.count}</span>
            </div>
            <div className="text-xs font-medium mt-2 truncate">{service.label}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search client or advisory case…" className="w-full h-9 pl-9 pr-3 rounded-md border bg-background text-sm" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CaseStatus | "all")} className="h-9 px-3 rounded-md border bg-background text-sm">
          <option value="all">All statuses</option>
          {STATUSES.map((status) => <option key={status.key} value={status.key}>{status.label}</option>)}
        </select>
      </div>

      {filteredCases.length === 0 ? (
        <div className="border rounded-lg bg-card p-10 text-center text-sm text-muted-foreground">No advisory cases match the current filters.</div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredCases.map((item) => {
            const service = SERVICE_MAP[(item.stage || "company") as ServiceKey] ?? SERVICE_MAP.company;
            return (
              <button key={item.id} onClick={() => openCase(item)} className="text-left bg-card border rounded-lg p-4 hover:border-primary/50 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{item.title}</div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{item.clients?.company_name ?? "No client"}</div>
                  </div>
                  <span className={`text-[11px] px-2 py-1 rounded-full whitespace-nowrap ${service.color}`}>{service.short}</span>
                </div>
                {item.description && <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{item.description}</p>}
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="px-2 py-1 rounded-full bg-muted">{STATUSES.find((s) => s.key === item.status)?.label ?? item.status}</span>
                  <span className="text-muted-foreground">{formatDate(item.created_at)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-card border rounded-lg w-full max-w-xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-semibold">New advisory case</h2><button onClick={() => setShowNew(false)}><X className="h-4 w-4" /></button></div>
            <div>
              <label className="text-xs text-muted-foreground">Service</label>
              <select value={newCase.service} onChange={(e) => setNewCase((v) => ({ ...v, service: e.target.value as ServiceKey }))} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm">
                {SERVICES.map((service) => <option key={service.key} value={service.key}>{service.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Client</label>
              <select value={newCase.client_id} onChange={(e) => setNewCase((v) => ({ ...v, client_id: e.target.value }))} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm">
                <option value="">Select client…</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Case / engagement title</label>
              <input value={newCase.title} onChange={(e) => setNewCase((v) => ({ ...v, title: e.target.value }))} placeholder="e.g. Change of company name" className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Client problem / scope</label>
              <textarea value={newCase.description} onChange={(e) => setNewCase((v) => ({ ...v, description: e.target.value }))} rows={4} placeholder="Describe what the client needs, the problem, objective or scope…" className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm" />
            </div>
            <button onClick={createCase} className="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm">Create case</button>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 md:p-6" onClick={() => setSelected(null)}>
          <div className="bg-card border rounded-lg w-full max-w-5xl max-h-[94vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 bg-card border-b p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-lg truncate">{selected.title}</h2>
                  <span className={`text-[11px] px-2 py-1 rounded-full ${SERVICE_MAP[(selected.stage || "company") as ServiceKey]?.color ?? "bg-muted"}`}>{SERVICE_MAP[(selected.stage || "company") as ServiceKey]?.short ?? "Advisory"}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{selected.clients?.company_name ?? "No client"}</div>
              </div>
              <button onClick={() => setSelected(null)}><X className="h-5 w-5" /></button>
            </div>

            <div className="p-4 space-y-5">
              <div className="grid md:grid-cols-3 gap-3">
                <div className="md:col-span-2 border rounded-lg p-3">
                  <div className="text-xs font-medium mb-2">Client problem / scope</div>
                  <div className="text-sm whitespace-pre-wrap text-muted-foreground">{selected.description || "No description added."}</div>
                </div>
                <div className="border rounded-lg p-3 space-y-2">
                  <div className="text-xs font-medium">Case status</div>
                  <select value={selected.status} onChange={(e) => updateCase({ status: e.target.value })} className="w-full h-9 px-2 rounded-md border bg-background text-sm">
                    {STATUSES.map((status) => <option key={status.key} value={status.key}>{status.label}</option>)}
                  </select>
                  <div className="text-[11px] text-muted-foreground">No mandatory project stages. Activities can be added, removed or rearranged as the case develops.</div>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between"><div><div className="font-medium">Activities</div><div className="text-xs text-muted-foreground">Work items, requirements and follow-ups for this case.</div></div></div>
                <div className="space-y-2">
                  {(selected.advisory_milestones ?? []).length === 0 && <div className="text-sm text-muted-foreground py-2">No activities yet. Add the first one below.</div>}
                  {(selected.advisory_milestones ?? []).map((activity: any) => {
                    const assignee = staff.find((s) => s.id === activity.assigned_to)?.full_name;
                    const docs = activityDocs[activity.id] ?? [];
                    return (
                      <div key={activity.id} className="border rounded-md p-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleActivity(activity)} className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${activity.done ? "bg-primary text-primary-foreground" : ""}`}>{activity.done && <CheckCircle2 className="h-4 w-4" />}</button>
                          <div className={`flex-1 min-w-0 text-sm ${activity.done ? "line-through text-muted-foreground" : ""}`}>{activity.title}</div>
                          {activity.due_date && <span className="text-[11px] text-muted-foreground">Due {formatDate(activity.due_date)}</span>}
                          <button onClick={() => { const next = !expandedActivity[activity.id]; setExpandedActivity((v) => ({ ...v, [activity.id]: next })); if (next && !activityDocs[activity.id]) loadDocs(activity.id); }} className="text-muted-foreground"><ChevronDown className={`h-4 w-4 transition ${expandedActivity[activity.id] ? "rotate-180" : ""}`} /></button>
                          <button onClick={() => deleteActivity(activity.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
                        </div>
                        {(assignee || activity.notes) && <div className="ml-7 mt-1 text-xs text-muted-foreground">{assignee && `Assigned to ${assignee}`}{assignee && activity.notes && " · "}{activity.notes}</div>}
                        {expandedActivity[activity.id] && (
                          <div className="ml-7 mt-3 border-t pt-3 space-y-2">
                            <div className="flex items-center justify-between"><div className="text-xs font-medium">Documents</div><label className="cursor-pointer text-xs inline-flex items-center gap-1 px-2 py-1 rounded bg-primary text-primary-foreground"><Upload className="h-3 w-3" />{uploading === activity.id ? "Uploading…" : "Upload"}<input type="file" hidden disabled={uploading === activity.id} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadDocument(activity.id, file); e.target.value = ""; }} /></label></div>
                            {docs.length === 0 ? <div className="text-xs text-muted-foreground">No documents attached.</div> : docs.map((doc: any) => <button key={doc.id} onClick={() => openDocument(doc.file_path)} className="w-full text-left flex items-center gap-2 text-xs p-2 rounded hover:bg-muted"><FileText className="h-4 w-4" /><span className="truncate">{doc.title}</span></button>)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="border-t pt-3 grid md:grid-cols-4 gap-2">
                  <input value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} placeholder="Activity / requirement *" className="h-9 px-3 rounded-md border bg-background text-sm md:col-span-2" />
                  <input type="date" value={activityDue} onChange={(e) => setActivityDue(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm" />
                  <select value={activityAssignee} onChange={(e) => setActivityAssignee(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm"><option value="">Assign to…</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select>
                  <textarea value={activityNotes} onChange={(e) => setActivityNotes(e.target.value)} placeholder="Notes / action / requirement detail" rows={2} className="md:col-span-3 px-3 py-2 rounded-md border bg-background text-sm" />
                  <button onClick={addActivity} className="h-9 rounded-md bg-primary text-primary-foreground text-sm self-end">Add activity</button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 border-t pt-4">
                <button onClick={() => setEditing(selected)} className="h-9 px-3 rounded-md border text-sm inline-flex items-center gap-2"><Pencil className="h-4 w-4" /> Edit case</button>
                <button onClick={() => deleteCase(selected.id)} className="h-9 px-3 rounded-md border border-destructive/30 text-destructive text-sm inline-flex items-center gap-2"><Trash2 className="h-4 w-4" /> Delete case</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card border rounded-lg w-full max-w-xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-semibold">Edit advisory case</h2><button onClick={() => setEditing(null)}><X className="h-4 w-4" /></button></div>
            <input value={editing.title} onChange={(e) => setEditing((v: any) => ({ ...v, title: e.target.value }))} className="w-full h-9 px-3 rounded-md border bg-background text-sm" />
            <textarea value={editing.description ?? ""} onChange={(e) => setEditing((v: any) => ({ ...v, description: e.target.value }))} rows={5} className="w-full px-3 py-2 rounded-md border bg-background text-sm" />
            <button onClick={async () => { const { error } = await supabase.from("advisory_projects").update({ title: editing.title.trim(), description: editing.description?.trim() || null }).eq("id", editing.id); if (error) toast.error(error.message); else { toast.success("Case updated."); setEditing(null); await load(); await openCase(editing); } }} className="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm">Save changes</button>
          </div>
        </div>
      )}
    </div>
  );
}
