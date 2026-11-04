import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Ticket, ServiceTemplate, Control, Asset, PersonLookup, AssetForm, TicketForm } from "./types";

export type StaffRow = { id: string; full_name: string | null };

// All data loading, live updates and database writes for the ICT Service Desk.
// The page and its components only render; every Supabase call lives here.
export function useIctDesk() {
  const { user, access, canCreate } = useAuth();
  const fullAccess = access("ict_service_desk") === "full";
  // ICT team members (Amos, Herman, ...) work the desk: they see and update
  // every ticket. Assets + deleting tickets stay Director/Admin only.
  const [isIctTeam, setIsIctTeam] = useState(false);
  const canManageTickets = fullAccess || isIctTeam;
  const canRaiseTicket = canCreate("ict_service_desk");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [allStaff, setAllStaff] = useState<StaffRow[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Service templates + checklists. If the migration hasn't been applied yet these
  // stay empty and the page behaves exactly as before.
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [maintenanceCount, setMaintenanceCount] = useState(0);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetTotalQty, setAssetTotalQty] = useState(0);

  // RLS already scopes this correctly: regular staff only see tickets they
  // reported, full-access roles (Director/Admin) see every ticket — so a
  // plain select gives each viewer exactly the counts/rows they should see.
  async function load() {
    setLoading(true);
    const [ticketsRes, openRes, criticalRes, staffRes, assetsRes, teamRes, tplRes, ctlRes, maintRes] = await Promise.all([
      supabase.from("ict_tickets").select("*").order("created_at", { ascending: false }),
      supabase.from("ict_tickets").select("id", { count: "exact", head: true }).not("status", "in", "(Resolved,Closed)"),
      supabase.from("ict_tickets").select("id", { count: "exact", head: true }).eq("priority", "Critical"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
      // ict_assets is RLS-restricted to Director/Admin; this simply returns
      // nothing for everyone else instead of erroring.
      fullAccess ? supabase.from("ict_assets").select("*").order("name") : Promise.resolve({ data: [], error: null }),
      supabase.from("ict_service_desk_team").select("user_id"),
      (supabase.from("ict_service_templates" as any) as any).select("service_type, title, description, sort_order").eq("active", true).order("sort_order"),
      (supabase.from("ict_case_controls" as any) as any).select("*"),
      supabase.from("ict_tickets").select("id", { count: "exact", head: true }).eq("service_type", "maintenance").not("status", "in", "(Resolved,Closed)"),
    ]);
    if (ticketsRes.error) toast.error(ticketsRes.error.message);
    if (assetsRes.error) toast.error(assetsRes.error.message);
    setTickets((ticketsRes.data as Ticket[]) ?? []);
    setOpenCount(openRes.count ?? 0);
    setCriticalCount(criticalRes.count ?? 0);
    // Template/checklist queries fail harmlessly until the migration is applied.
    setTemplates(tplRes.error ? [] : ((tplRes.data as ServiceTemplate[]) ?? []));
    setControls(ctlRes.error ? [] : ((ctlRes.data as Control[]) ?? []));
    setMaintenanceCount(maintRes.error ? 0 : (maintRes.count ?? 0));
    const directory = (staffRes.data as any[]) ?? [];
    setAllStaff(directory);
    // Ticket assignees are the ICT service-desk team (ict_service_desk_team
    // table). Falls back to matching Amos/Herman by name if it's still empty.
    const teamIds = new Set(((teamRes.data as any[]) ?? []).map((t) => t.user_id));
    setIsIctTeam(!!user && teamIds.has(user.id));
    setStaff(
      teamIds.size > 0
        ? directory.filter((p) => teamIds.has(p.id))
        : directory.filter((p) => ["amos", "herman"].some((n) => (p.full_name ?? "").toLowerCase().includes(n))),
    );
    const assetRows = (assetsRes.data as Asset[]) ?? [];
    setAssets(assetRows);
    setAssetTotalQty(assetRows.reduce((sum, a) => sum + (a.quantity ?? 0), 0));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Live refresh: a newly raised or updated ticket shows up without a reload.
  useEffect(() => {
    const ch = supabase
      .channel("ict-desk-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "ict_tickets" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "ict_case_controls" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);


  // Only full-access roles (Director/Admin) hit this — the RLS "update"
  // policy on ict_tickets enforces the same rule server-side regardless.
  async function updateTicket(id: string, patch: Partial<Pick<Ticket, "status" | "assigned_to">>) {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))); // optimistic
    const { error } = await supabase.from("ict_tickets").update(patch).eq("id", id);
    if (error) { toast.error(error.message); load(); return; }
    toast.success("Ticket updated");
  }


  // ict_assets RLS restricts insert/update/delete to Director/Admin ("full"
  // rank on ict_service_desk) regardless of what the UI shows.
  // Returns true on success so the dialog knows whether to close.
  async function saveAsset(assetForm: AssetForm): Promise<boolean> {
    if (!assetForm.name.trim() || !user) return false;
    const payload = {
      name: assetForm.name.trim(),
      description: assetForm.description.trim() || null,
      quantity: Number(assetForm.quantity) || 1,
      unit_cost: assetForm.unit_cost ? Number(assetForm.unit_cost) : null,
      purchase_date: assetForm.purchase_date || null,
      assigned_to: assetForm.assigned_to || null,
    };
    const { error } = assetForm.id
      ? await supabase.from("ict_assets").update(payload).eq("id", assetForm.id)
      : await supabase.from("ict_assets").insert({ ...payload, created_by: user.id });
    if (error) { toast.error(error.message); return false; }
    toast.success(assetForm.id ? "Asset updated" : "Asset added");
    load();
    return true;
  }

  async function deleteAsset(id: string) {
    if (!confirm("Delete this asset?")) return;
    const { error } = await supabase.from("ict_assets").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Asset deleted"); load(); }
  }

  async function deleteTicket(id: string) {
    if (!confirm("Delete this ticket?")) return;
    const { error } = await supabase.from("ict_tickets").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Ticket deleted"); load(); }
  }


  // Returns true on success so the dialog knows whether to close and reset.
  async function raiseTicket(form: TicketForm): Promise<boolean> {
    if (!form.title.trim() || !user) return false;
    const { data, error } = await supabase
      .from("ict_tickets")
      .insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        priority: form.priority,
        assigned_to: form.assigned_to || null,
        reported_by: user.id,
        // only sent once the templates migration is in place
        ...(templates.length > 0 ? { service_type: form.service_type } : {}),
      } as any)
      .select("ticket_number")
      .single();
    if (error) { toast.error(error.message); return false; }
    toast.success(`Ticket ${data?.ticket_number ?? ""} raised`.trim());
    load();
    return true;
  }

  const controlsByTicket = useMemo(() => {
    const m = new Map<string, Control[]>();
    for (const c of controls) { const a = m.get(c.ticket_id); if (a) a.push(c); else m.set(c.ticket_id, [c]); }
    return m;
  }, [controls]);
  const nameOf: PersonLookup = (id) => (id ? allStaff.find((p) => p.id === id)?.full_name ?? "Unknown" : "—");
  const typeTitle = (key: string | null | undefined) => templates.find((t) => t.service_type === key)?.title ?? (key && key !== "general" ? key : "General");

  return {
    user, fullAccess, canManageTickets, canRaiseTicket,
    tickets, staff, allStaff, openCount, criticalCount, loading,
    templates, controls, controlsByTicket, maintenanceCount, assets, assetTotalQty,
    nameOf, typeTitle, load, updateTicket, deleteTicket, saveAsset, deleteAsset, raiseTicket,
  };
}
