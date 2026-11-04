import { ServiceTemplate, TicketForm, CATEGORIES, PRIORITIES } from "./types";
import { StaffRow } from "./use-ict-desk";
import { ModalForm } from "@/components/modal-form";

export function TicketFormDialog({ open, form, setForm, templates, staff, saving, onClose, onSubmit }: {
  open: boolean;
  form: TicketForm;
  setForm: (f: TicketForm) => void;
  templates: ServiceTemplate[];
  staff: StaffRow[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  if (!open) return null;
  const selectedTemplate = templates.find((t) => t.service_type === form.service_type);
  return (
    <ModalForm title="Raise a ticket" onClose={onClose} onSubmit={onSubmit}>
            <input
              required
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full h-9 px-3 rounded-md border bg-background text-sm"
            />
            <textarea
              placeholder="Describe the issue"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm"
            />
            {templates.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground">What kind of request is this?</label>
                <select
                  value={form.service_type}
                  onChange={(e) => setForm({ ...form, service_type: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm mt-1"
                >
                  {templates.map((t) => <option key={t.service_type} value={t.service_type}>{t.title}</option>)}
                </select>
                {selectedTemplate?.description && <p className="text-xs text-muted-foreground mt-1">{selectedTemplate.description}</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-9 px-3 rounded-md border bg-background text-sm">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-9 px-3 rounded-md border bg-background text-sm">
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Assign to (ICT)</label>
              <select
                value={form.assigned_to}
                onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                className="w-full h-9 px-3 rounded-md border bg-background text-sm mt-1"
              >
                <option value="">Any ICT team member</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name ?? "Unnamed"}</option>)}
              </select>
            </div>
            <button disabled={saving} className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-transform active:scale-[0.98]">
              {saving ? "Submitting…" : "Submit ticket"}
            </button>
    </ModalForm>
  );
}
