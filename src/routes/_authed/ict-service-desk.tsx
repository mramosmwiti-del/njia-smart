import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Ticket as TicketIcon, HardDrive, Wrench, AlertTriangle, Plus } from "lucide-react";
import { IctPasswordVault } from "@/components/ict/ict-password-vault";
import { StatCard } from "@/components/ict-service-desk/stat-card";
import { TicketsTable } from "@/components/ict-service-desk/tickets-table";
import { AssetsPanel } from "@/components/ict-service-desk/assets-panel";
import { TicketFormDialog } from "@/components/ict-service-desk/ticket-form-dialog";
import { AssetFormDialog } from "@/components/ict-service-desk/asset-form-dialog";
import { useIctDesk } from "@/components/ict-service-desk/use-ict-desk";
import { EMPTY_FORM, EMPTY_ASSET_FORM, type Asset } from "@/components/ict-service-desk/types";

export const Route = createFileRoute("/_authed/ict-service-desk")({
  head: () => ({
    meta: [
      { title: "ICT Service Desk | G.K Nahashon & Company" },
      { name: "description", content: "Internal IT support, assets and maintenance." },
    ],
  }),
  component: IctServiceDesk,
});

// Page shell only: data + writes live in use-ict-desk, the tables/dialogs in
// components/ict-service-desk/*. This file just wires filters and dialogs together.
function IctServiceDesk() {
  const desk = useIctDesk();
  const {
    fullAccess, canManageTickets, canRaiseTicket, tickets, staff, allStaff, openCount, criticalCount,
    loading, templates, controlsByTicket, maintenanceCount, assets, assetTotalQty, nameOf, typeTitle,
  } = desk;

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [assetFormOpen, setAssetFormOpen] = useState(false);
  const [assetForm, setAssetForm] = useState(EMPTY_ASSET_FORM);
  const [assetSaving, setAssetSaving] = useState(false);

  const visibleTickets = tickets.filter((t) =>
    (!typeFilter || (t.service_type ?? "general") === typeFilter) &&
    (!priorityFilter || t.priority === priorityFilter) &&
    (!openOnly || !["Resolved", "Closed"].includes(t.status))
  );
  const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const toggleExpanded = (id: string) => setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  function openNewAsset() { setAssetForm(EMPTY_ASSET_FORM); setAssetFormOpen(true); }
  function openEditAsset(a: Asset) {
    setAssetForm({
      id: a.id,
      name: a.name,
      description: a.description ?? "",
      quantity: String(a.quantity ?? 1),
      unit_cost: a.unit_cost != null ? String(a.unit_cost) : "",
      purchase_date: a.purchase_date ?? "",
      assigned_to: a.assigned_to ?? "",
    });
    setAssetFormOpen(true);
  }

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const ok = await desk.raiseTicket(form);
    setSaving(false);
    if (ok) { setForm(EMPTY_FORM); setFormOpen(false); }
  }

  async function submitAsset(e: React.FormEvent) {
    e.preventDefault();
    setAssetSaving(true);
    const ok = await desk.saveAsset(assetForm);
    setAssetSaving(false);
    if (ok) setAssetFormOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">ICT Service Desk</h1>
          <p className="text-sm text-muted-foreground">Internal IT support, assets and maintenance.</p>
        </div>
        {canRaiseTicket && (
          <button
            onClick={() => setFormOpen(true)}
            className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-2 transition-transform active:scale-95"
          >
            <Plus className="h-4 w-4" /> Raise a ticket
          </button>
        )}
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TicketIcon} label="Open Tickets" value={openCount} onClick={() => { setTypeFilter(""); setPriorityFilter(""); setOpenOnly(true); jumpTo("ict-ticket-list"); }} />
        {fullAccess && <StatCard icon={HardDrive} label="Assets" value={assetTotalQty} onClick={() => jumpTo("ict-assets")} />}
        <StatCard icon={Wrench} label="Active Maintenance" value={maintenanceCount} onClick={() => { setTypeFilter("maintenance"); setPriorityFilter(""); setOpenOnly(true); jumpTo("ict-ticket-list"); }} />
        <StatCard icon={AlertTriangle} label="Critical Issues" value={criticalCount} onClick={() => { setTypeFilter(""); setPriorityFilter("Critical"); setOpenOnly(false); jumpTo("ict-ticket-list"); }} />
      </div>

      <TicketsTable
        tickets={tickets}
        visibleTickets={visibleTickets}
        loading={loading}
        templates={templates}
        controlsByTicket={controlsByTicket}
        staff={staff}
        allStaff={allStaff}
        nameOf={nameOf}
        typeTitle={typeTitle}
        canManageTickets={canManageTickets}
        fullAccess={fullAccess}
        userId={desk.user?.id}
        expanded={expanded}
        onToggleExpanded={toggleExpanded}
        typeFilter={typeFilter}
        onTypeFilter={setTypeFilter}
        onUpdateTicket={desk.updateTicket}
        onDeleteTicket={desk.deleteTicket}
        onChanged={desk.load}
      />

      {fullAccess && (
        <AssetsPanel assets={assets} allStaff={allStaff} onAdd={openNewAsset} onEdit={openEditAsset} onDelete={desk.deleteAsset} />
      )}

      {fullAccess && <IctPasswordVault />}

      <TicketFormDialog
        open={formOpen}
        form={form}
        setForm={setForm}
        templates={templates}
        staff={staff}
        saving={saving}
        onClose={() => setFormOpen(false)}
        onSubmit={submitTicket}
      />

      <AssetFormDialog
        open={assetFormOpen}
        form={assetForm}
        setForm={setAssetForm}
        allStaff={allStaff}
        saving={assetSaving}
        onClose={() => setAssetFormOpen(false)}
        onSubmit={submitAsset}
      />
    </div>
  );
}
