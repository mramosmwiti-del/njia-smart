import { X } from "lucide-react";
import { STATUSES } from "./constants";
import type { ServiceModuleCtx } from "./use-service-module";

export function ProjectDialog({ ctx }: { ctx: ServiceModuleCtx }) {
  const { STAGES, defaultStageKey, clients, dialog, setDialog, save, moduleLabel, projectTemplates } = ctx;
  return (
    <>
      {dialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDialog(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-card w-full max-w-md rounded-lg p-6 space-y-3">
            <div className="flex justify-between"><h2 className="text-lg font-semibold">{dialog.mode === "new" ? `New ${moduleLabel} project` : "Edit project"}</h2><button onClick={() => setDialog(null)}><X className="h-4 w-4" /></button></div>
            {dialog.mode === "new" && projectTemplates.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">ICT project template</label>
                <select value={dialog.data.service_type ?? projectTemplates[0].serviceType} onChange={e => {
                  const template = projectTemplates.find(t => t.serviceType === e.target.value);
                  setDialog({ ...dialog, data: { ...dialog.data, service_type: e.target.value, description: template?.description ?? dialog.data.description, title: dialog.data.title || template?.label || "" } });
                }} className="w-full h-9 px-3 rounded-md border bg-background text-sm">
                  {projectTemplates.map(t => <option key={t.serviceType} value={t.serviceType}>{t.label}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">A starter checklist will be created automatically. You can edit the steps in the project workspace.</p>
              </div>
            )}
            <select value={dialog.data.client_id} onChange={e => setDialog({ ...dialog, data: { ...dialog.data, client_id: e.target.value } })} className="w-full h-9 px-3 rounded-md border bg-background text-sm">
              <option value="">Select client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
            <input placeholder="Title *" value={dialog.data.title} onChange={e => setDialog({ ...dialog, data: { ...dialog.data, title: e.target.value } })} className="w-full h-9 px-3 rounded-md border bg-background text-sm" />
            <textarea placeholder="Scope / description" value={dialog.data.description ?? ""} onChange={e => setDialog({ ...dialog, data: { ...dialog.data, description: e.target.value } })} rows={3} className="w-full px-3 py-2 rounded-md border bg-background text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <select value={dialog.data.status} onChange={e => setDialog({ ...dialog, data: { ...dialog.data, status: e.target.value } })} className="h-9 px-3 rounded-md border bg-background text-sm capitalize">
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
              <select value={dialog.data.stage ?? defaultStageKey} onChange={e => setDialog({ ...dialog, data: { ...dialog.data, stage: e.target.value } })} className="h-9 px-3 rounded-md border bg-background text-sm">
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted-foreground">Start date
                <input type="date" value={dialog.data.start_date ?? ""} onChange={e => setDialog({ ...dialog, data: { ...dialog.data, start_date: e.target.value } })} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm" />
              </label>
              <label className="text-xs text-muted-foreground">Target close
                <input type="date" value={dialog.data.due_date ?? ""} onChange={e => setDialog({ ...dialog, data: { ...dialog.data, due_date: e.target.value } })} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm" />
              </label>
            </div>
            <button onClick={save} className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium">Save</button>
          </div>
        </div>
      )}
    </>
  );
}
