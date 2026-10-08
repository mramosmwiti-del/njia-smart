import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  Landmark,
  Lightbulb,
  Plus,
  Scale,
  Trash2,
  Users,
  WalletCards,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authed/advisory")({
  head: () => ({
    meta: [
      { title: "Advisory | G.K Nahashon & Company" },
      {
        name: "description",
        content: "Advisory service desk for business registration, CBK digital credit providers, company advisory, financial advisory and PBO services.",
      },
    ],
  }),
  component: AdvisoryPage,
});

type ServiceKey = "brs" | "cbk_dcp" | "company" | "financial" | "pbo";

type Service = {
  key: ServiceKey;
  name: string;
  authority: string;
  description: string;
  icon: typeof Building2;
  steps: string[];
};

const SERVICES: Service[] = [
  {
    key: "brs",
    name: "Business Registration (BRS)",
    authority: "Business Registration Service",
    description: "Company and business registry services, including registration, linking, filings, CR12 and changes of particulars.",
    icon: Building2,
    steps: [
      "Confirm client request and entity details",
      "Name search / reservation where applicable",
      "Prepare and submit registration or requested BRS service",
      "Link / update client access and registry records where required",
      "Prepare statutory filing or change of particulars",
      "Obtain CR12 / official search where requested",
      "Handle change of name or other registry amendment where applicable",
      "Receive, review and deliver final registry documents",
    ],
  },
  {
    key: "cbk_dcp",
    name: "Digital Credit Provider (CBK)",
    authority: "Central Bank of Kenya",
    description: "CBK licensing support for digital credit providers, with a structured checklist that can be adjusted to the client's circumstances.",
    icon: Landmark,
    steps: [
      "Confirm DCP business model and applicant status",
      "Name approval / reservation (new applicants)",
      "Prepare licence application and supporting documents",
      "Submit application and application fee",
      "CBK completeness and compliance review",
      "Address CBK queries / requests for additional information",
      "Data submission / regulatory reporting testing",
      "Pay prescribed licence fee when notified",
      "Receive CBK licence and confirm publication / licensing record",
      "Post-licensing compliance handover",
    ],
  },
  {
    key: "company",
    name: "Company Advisory",
    authority: "Client-specific advisory",
    description: "Open advisory work based on the client's problem, question, decision or business need.",
    icon: BriefcaseBusiness,
    steps: [],
  },
  {
    key: "financial",
    name: "Financial Advisory",
    authority: "Financial analysis & consultancy",
    description: "Financial analysis, dividend matters, financial decision support and other finance-related consultancy assignments.",
    icon: WalletCards,
    steps: [],
  },
  {
    key: "pbo",
    name: "PBO / NGO Advisory (PBORA)",
    authority: "Public Benefit Organizations Regulatory Authority",
    description: "PBO registration and related regulatory services, including post-registration support and NGO transition matters.",
    icon: Users,
    steps: [
      "Identify the client's PBO / NGO service and eligibility route",
      "Name search / reservation",
      "Prepare or review constitution and governance documents",
      "Prepare minutes, officials' particulars and supporting documents",
      "Prepare proposed one-year budget and application package",
      "Submit application through the prescribed platform",
      "Track PBORA review and respond to queries",
      "Receive and review certificate / approval",
      "Complete post-registration handover and compliance guidance",
    ],
  },
];

const serviceByKey = (key?: string | null) => SERVICES.find((s) => s.key === key);

function AdvisoryPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceKey | null>(null);
  const [form, setForm] = useState({ client_id: "", description: "", due_date: "" });
  const [customStep, setCustomStep] = useState("");

  async function load() {
    setLoading(true);
    const [p, c] = await Promise.all([
      supabase
        .from("advisory_projects")
        .select("*, clients(company_name), advisory_milestones(id,title,due_date,done,created_at)")
        .order("created_at", { ascending: false }),
      supabase.from("clients").select("id, company_name").order("company_name"),
    ]);
    if (p.error) toast.error(p.error.message);
    if (c.error) toast.error(c.error.message);
    setRows(p.data ?? []);
    setClients(c.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status !== "completed").length;
    const completed = rows.filter((r) => r.status === "completed").length;
    const byService = SERVICES.map((s) => ({
      ...s,
      count: rows.filter((r) => getServiceKey(r) === s.key).length,
    }));
    return { active, completed, byService };
  }, [rows]);

  function resetNew() {
    setNewOpen(false);
    setSelectedService(null);
    setForm({ client_id: "", description: "", due_date: "" });
  }

  async function createCase() {
    if (!selectedService || !form.client_id) {
      toast.error("Select the advisory service and client first.");
      return;
    }
    if ((selectedService.key === "company" || selectedService.key === "financial") && !form.description.trim()) {
      toast.error("Add a description of the client's problem or advisory request.");
      return;
    }

    const { data, error } = await supabase
      .from("advisory_projects")
      .insert({
        client_id: form.client_id,
        title: selectedService.name,
        description: form.description.trim() || selectedService.description,
        due_date: form.due_date || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      toast.error(error?.message ?? "Could not create advisory case.");
      return;
    }

    const templateSteps = selectedService.steps;
    if (templateSteps.length) {
      const { error: stepError } = await supabase.from("advisory_milestones").insert(
        templateSteps.map((title) => ({
          project_id: data.id,
          title,
          due_date: form.due_date || null,
          done: false,
        })),
      );
      if (stepError) toast.error(stepError.message);
    }

    toast.success(`${selectedService.name} advisory case created.`);
    resetNew();
    load();
  }

  async function toggleStep(step: any) {
    const { error } = await supabase.from("advisory_milestones").update({ done: !step.done }).eq("id", step.id);
    if (error) toast.error(error.message);
    else load();
  }

  async function addCustomStep(row: any) {
    if (!customStep.trim()) return;
    const { error } = await supabase.from("advisory_milestones").insert({
      project_id: row.id,
      title: customStep.trim(),
      done: false,
      due_date: row.due_date || null,
    });
    if (error) toast.error(error.message);
    else {
      setCustomStep("");
      toast.success("Step added.");
      load();
    }
  }

  async function deleteCase(id: string) {
    if (!confirm("Delete this advisory case and its checklist?")) return;
    const { error } = await supabase.from("advisory_projects").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      setOpenId(null);
      toast.success("Advisory case deleted.");
      load();
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Advisory</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            A service desk for advisory assignments — choose what the client needs, then work from the relevant checklist. Company and financial advisory remain open-ended.
          </p>
        </div>
        <button onClick={() => setNewOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <Plus className="h-4 w-4" /> New advisory case
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Active cases" value={stats.active} icon={ClipboardList} />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} />
        <StatCard label="Service types" value={SERVICES.length} icon={Scale} />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Advisory services</h2>
          <span className="text-xs text-muted-foreground">Select a service when opening a case</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {stats.byService.map((service) => {
            const Icon = service.icon;
            return (
              <button key={service.key} onClick={() => { setSelectedService(service.key); setNewOpen(true); }} className="text-left rounded-lg border bg-card p-4 hover:border-primary/50 hover:bg-muted/20 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-md bg-primary/10 p-2"><Icon className="h-5 w-5 text-primary" /></div>
                  <span className="text-xs rounded-full bg-muted px-2 py-1">{service.count}</span>
                </div>
                <h3 className="font-semibold mt-3 text-sm">{service.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{service.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Open advisory work</h2>
            <p className="text-xs text-muted-foreground">Each client assignment is independent; no fixed project stages.</p>
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading advisory work…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <FileCheck2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="font-medium">No advisory cases yet</p>
            <p className="text-sm text-muted-foreground mt-1">Start by opening a case for a client.</p>
          </div>
        ) : (
          <div className="divide-y">
            {rows.map((row) => {
              const service = serviceByKey(getServiceKey(row));
              const steps = [...(row.advisory_milestones ?? [])].sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
              const completed = steps.filter((s) => s.done).length;
              const isOpen = openId === row.id;
              return (
                <div key={row.id}>
                  <button onClick={() => setOpenId(isOpen ? null : row.id)} className="w-full text-left px-4 py-4 hover:bg-muted/20">
                    <div className="flex items-center gap-3">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{row.clients?.company_name ?? "Unknown client"}</span>
                          <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">{service?.name ?? row.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{row.description || "No advisory description provided."}</p>
                      </div>
                      <div className="hidden sm:block text-right text-xs text-muted-foreground">
                        <div>{completed}/{steps.length} complete</div>
                        {row.due_date && <div>Due {formatDate(row.due_date)}</div>}
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-11 pb-5 space-y-4 bg-muted/10">
                      <div className="pt-2 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Client request</p>
                          <p className="text-sm mt-1 whitespace-pre-wrap">{row.description || "No description provided."}</p>
                        </div>
                        <button onClick={() => deleteCase(row.id)} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline self-start">
                          <Trash2 className="h-3.5 w-3.5" /> Delete case
                        </button>
                      </div>

                      <div className="rounded-md border bg-card p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div>
                            <h3 className="font-medium text-sm">Work checklist</h3>
                            <p className="text-xs text-muted-foreground">Template steps can be completed or extended with client-specific work.</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{completed}/{steps.length}</span>
                        </div>
                        <div className="space-y-2">
                          {steps.map((step: any) => (
                            <label key={step.id} className="flex items-start gap-3 rounded-md border p-3 hover:bg-muted/30 cursor-pointer">
                              <input type="checkbox" checked={!!step.done} onChange={() => toggleStep(step)} className="mt-0.5" />
                              <span className={`text-sm flex-1 ${step.done ? "line-through text-muted-foreground" : ""}`}>{step.title}</span>
                              {step.done && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                            </label>
                          ))}
                          {steps.length === 0 && <p className="text-sm text-muted-foreground">No predefined steps — add the work items that fit this advisory assignment.</p>}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <input value={customStep} onChange={(e) => setCustomStep(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustomStep(row)} placeholder="Add a client-specific step…" className="flex-1 h-9 rounded-md border bg-background px-3 text-sm" />
                          <button onClick={() => addCustomStep(row)} className="h-9 px-3 rounded-md border text-sm inline-flex items-center gap-1"><Plus className="h-4 w-4" /> Add</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {newOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={resetNew}>
          <div className="bg-card border rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h2 className="font-semibold">New advisory case</h2>
                <p className="text-xs text-muted-foreground">Choose the service first. The case stays independent from other clients and assignments.</p>
              </div>
              <button onClick={resetNew}><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-5">
              <div>
                <label className="text-sm font-medium">Advisory service</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {SERVICES.map((service) => {
                    const Icon = service.icon;
                    const active = selectedService === service.key;
                    return (
                      <button key={service.key} onClick={() => setSelectedService(service.key)} className={`text-left border rounded-md p-3 ${active ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:bg-muted/30"}`}>
                        <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><span className="font-medium text-sm">{service.name}</span></div>
                        <p className="text-xs text-muted-foreground mt-1">{service.authority}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedService && (
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-sm font-medium">{serviceByKey(selectedService)?.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{serviceByKey(selectedService)?.description}</p>
                  {serviceByKey(selectedService)?.steps.length ? (
                    <p className="text-xs text-muted-foreground mt-2">A starting checklist will be created automatically. You can add or remove work items later.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">This service has no fixed checklist. Describe the client's need and add the required work items after opening the case.</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Client</label>
                  <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className="mt-1 w-full h-10 rounded-md border bg-background px-3 text-sm">
                    <option value="">Select client…</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Target date <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="mt-1 w-full h-10 rounded-md border bg-background px-3 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Client problem / request</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={5} placeholder={selectedService?.key === "company" || selectedService?.key === "financial" ? "Describe what the client needs advice on…" : "Add context, special instructions or the client's request…"} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm resize-y" />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button onClick={resetNew} className="px-4 py-2 rounded-md border text-sm">Cancel</button>
                <button onClick={createCase} disabled={!selectedService || !form.client_id} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50">Create advisory case</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getServiceKey(row: any): ServiceKey | null {
  const title = String(row?.title ?? "").toLowerCase();
  if (title.includes("business registration") || title.includes("brs")) return "brs";
  if (title.includes("digital credit") || title.includes("cbk")) return "cbk_dcp";
  if (title.includes("financial advisory")) return "financial";
  if (title.includes("pbo") || title.includes("ngo") || title.includes("pbora")) return "pbo";
  if (title.includes("company advisory")) return "company";
  return null;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof ClipboardList }) {
  return (
    <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
      <div className="rounded-md bg-primary/10 p-2"><Icon className="h-5 w-5 text-primary" /></div>
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p></div>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
