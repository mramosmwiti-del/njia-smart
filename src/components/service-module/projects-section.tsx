import { Trash2, Pencil } from "lucide-react";
import { formatDate, STATUS_COLORS, statusLabel } from "@/lib/format";
import { ClientAssignments } from "@/components/client-assignments";
import type { ServiceModuleCtx } from "./use-service-module";

export function ProjectsSection({ ctx }: { ctx: ServiceModuleCtx }) {
  const { isAdmin, STAGES, defaultStageKey, stageLabel, tab, rows, setDialog, setMilestoneEditor, setClosureNotes, projectFilter, setProjectFilter, visibleRows, projectFilterLabel, remove, moduleLabel } = ctx;
  return (
    <>
      {tab === "projects" && projectFilter && projectFilterLabel[projectFilter] && (
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-primary/10 text-primary">{projectFilterLabel[projectFilter]} · {visibleRows.length}</span>
          <button onClick={() => setProjectFilter(null)} className="text-muted-foreground hover:text-foreground underline">Show all projects</button>
        </div>
      )}

      {tab === "projects" && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleRows.length === 0 && <div className="bg-card border rounded-lg p-8 text-center text-muted-foreground text-sm col-span-full">{rows.length === 0 ? `No ${moduleLabel.toLowerCase()} projects yet.` : "No projects match this filter."}</div>}
          {visibleRows.map(r => {
            const ms = r.service_milestones ?? [];
            const done = ms.filter((m: any) => m.done).length;
            const verified = ms.filter((m: any) => m.verified).length;
            const pct = ms.length ? Math.round((done / ms.length) * 100) : 0;
            const stageIdx = STAGES.findIndex(s => s.key === (r.stage ?? defaultStageKey));
            return (
              <div key={r.id} className="bg-card border rounded-lg p-4 hover:border-primary/50 transition">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{r.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.clients?.company_name}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full capitalize whitespace-nowrap ${STATUS_COLORS[r.status] || "bg-muted"}`}>{statusLabel(r.status)}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                  <span className={`px-2 py-0.5 rounded-full ${r.stage === "closed" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                    {r.stage === "closed" ? "Closed" : `Stage ${stageIdx + 1}/${STAGES.length - 1} · ${stageLabel(r.stage)}`}
                  </span>
                </div>
                {r.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{r.description}</p>}
                <div className="mt-3 text-xs text-muted-foreground flex justify-between">
                  <span>{done}/{ms.length} steps · {verified} verified</span>
                  <span>{r.start_date ? `${formatDate(r.start_date)} → ` : ""}{formatDate(r.due_date)}</span>
                </div>
                <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-accent" style={{ width: `${pct}%` }} /></div>
                {r.client_id && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Team:</span>
                    <ClientAssignments clientId={r.client_id} compact />
                  </div>
                )}
                <div className="mt-3 flex gap-2 text-xs">
                  <button onClick={() => { setMilestoneEditor(r); setClosureNotes(r.closure_notes ?? ""); }} className="text-primary hover:underline">Open workspace</button>
                  <button onClick={() => setDialog({ mode: "edit", data: r })} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><Pencil className="h-3 w-3" /> Edit</button>
                  {isAdmin && <button onClick={() => remove(r.id)} className="text-destructive ml-auto inline-flex items-center gap-1"><Trash2 className="h-3 w-3" /> Delete</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
