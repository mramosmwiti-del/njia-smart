import { ClientAssignments } from "@/components/client-assignments";
import type { ServiceModuleCtx } from "./use-service-module";

export function ClientsSection({ ctx }: { ctx: ServiceModuleCtx }) {
  const { tab, clientRollup, moduleLabel } = ctx;
  return (
    <>
      {tab === "clients" && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b bg-muted/40">
                <tr><th className="py-2 px-3">Client</th><th>Projects</th><th>Open</th><th>Team</th></tr>
              </thead>
              <tbody>
                {clientRollup.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">No clients on {moduleLabel} yet.</td></tr>}
                {clientRollup.map(c => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{c.company_name}</td>
                    <td>{c.projectCount}</td>
                    <td>{c.open}</td>
                    <td className="py-2 px-3"><ClientAssignments clientId={c.id} compact /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
