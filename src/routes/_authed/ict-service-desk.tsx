import { createFileRoute } from "@tanstack/react-router";
import { Ticket, HardDrive, Wrench, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authed/ict-service-desk")({
  head: () => ({
    meta: [
      { title: "ICT Service Desk | G.K Nahashon & Company" },
      { name: "description", content: "Internal IT support, assets and maintenance." },
    ],
  }),
  component: IctServiceDesk,
});

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="bg-card rounded-lg border p-4 h-full">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function IctServiceDesk() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ICT Service Desk</h1>
        <p className="text-sm text-muted-foreground">Internal IT support, assets and maintenance.</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Ticket} label="Open Tickets" value={0} />
        <StatCard icon={HardDrive} label="Assets" value={0} />
        <StatCard icon={Wrench} label="Active Maintenance" value={0} />
        <StatCard icon={AlertTriangle} label="Critical Issues" value={0} />
      </div>
    </div>
  );
}
