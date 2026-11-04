import { Plus } from "lucide-react";
import type { ServiceModuleCtx } from "./use-service-module";

export function ModuleHeader({ ctx }: { ctx: ServiceModuleCtx }) {
  const { defaultStageKey, tab, setTab, rows, setDialog, clientRollup, TABS, moduleLabel, tagline, projectTemplates } = ctx;
  return (
    <>
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{moduleLabel}</h1>
          <p className="text-sm text-muted-foreground">{tagline}</p>
        </div>
        {tab === "projects" && (
          <button onClick={() => setDialog({ mode: "new", data: { client_id: "", title: "", description: "", start_date: "", due_date: "", status: "not_started", stage: defaultStageKey, service_type: projectTemplates[0]?.serviceType ?? "general" } })} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-2"><Plus className="h-4 w-4" /> New project</button>
        )}
      </div>

      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px whitespace-nowrap ${tab === t.key ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
            {t.key === "projects" && <span className="ml-1 text-xs">({rows.length})</span>}
            {t.key === "clients" && <span className="ml-1 text-xs">({clientRollup.length})</span>}
          </button>
        ))}
      </div>
    </>
  );
}
