import { AssetForm } from "./types";
import { StaffRow } from "./use-ict-desk";
import { ModalForm } from "@/components/modal-form";

export function AssetFormDialog({ open, form, setForm, allStaff, saving, onClose, onSubmit }: {
  open: boolean;
  form: AssetForm;
  setForm: (f: AssetForm) => void;
  allStaff: StaffRow[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  if (!open) return null;
  return (
    <ModalForm title={form.id ? "Edit asset" : "Add asset"} onClose={onClose} onSubmit={onSubmit}>
            <input
              required
              placeholder="Item name (e.g. Dell Latitude laptop, HP LaserJet printer)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-9 px-3 rounded-md border bg-background text-sm"
            />
            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number" min={1} required
                placeholder="Quantity"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="h-9 px-3 rounded-md border bg-background text-sm"
              />
              <input
                type="number" min={0} step="0.01"
                placeholder="Unit cost (KES)"
                value={form.unit_cost}
                onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
                className="h-9 px-3 rounded-md border bg-background text-sm"
              />
              <input
                type="date"
                value={form.purchase_date}
                onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                className="h-9 px-3 rounded-md border bg-background text-sm"
              />
              <select
                value={form.assigned_to}
                onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                className="h-9 px-3 rounded-md border bg-background text-sm"
              >
                <option value="">Office (shared)</option>
                {allStaff.map((s) => <option key={s.id} value={s.id}>{s.full_name ?? "Unnamed"}</option>)}
              </select>
            </div>
            <button disabled={saving} className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-transform active:scale-[0.98]">
              {saving ? "Saving…" : form.id ? "Save changes" : "Add asset"}
            </button>
    </ModalForm>
  );
}
