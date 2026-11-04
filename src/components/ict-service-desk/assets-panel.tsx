import { Plus, Pencil, Trash2 } from "lucide-react";
import { Asset } from "./types";
import { StaffRow } from "./use-ict-desk";

export function AssetsPanel({ assets, allStaff, onAdd, onEdit, onDelete }: {
  assets: Asset[];
  allStaff: StaffRow[];
  onAdd: () => void;
  onEdit: (a: Asset) => void;
  onDelete: (id: string) => void;
}) {
  return (
        <div id="ict-assets" className="bg-card border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="text-sm font-medium">IT Assets</span>
            <button
              onClick={onAdd}
              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs inline-flex items-center gap-1.5 transition-transform active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" /> Add asset
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground border-b">
                <tr>
                  <th className="py-2 px-3">Item</th>
                  <th>Qty</th>
                  <th>Unit cost</th>
                  <th>Total</th>
                  <th>Date bought</th>
                  <th>Assigned to</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">No assets recorded yet.</td></tr>
                )}
                {assets.map((a) => {
                  const assignee = allStaff.find((s) => s.id === a.assigned_to);
                  const total = a.unit_cost != null ? a.unit_cost * a.quantity : null;
                  return (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 px-3">
                        <div className="font-medium">{a.name}</div>
                        {a.description && <div className="text-xs text-muted-foreground">{a.description}</div>}
                      </td>
                      <td className="text-xs">{a.quantity}</td>
                      <td className="text-xs">{a.unit_cost != null ? a.unit_cost.toLocaleString("en-KE", { style: "currency", currency: "KES" }) : "—"}</td>
                      <td className="text-xs">{total != null ? total.toLocaleString("en-KE", { style: "currency", currency: "KES" }) : "—"}</td>
                      <td className="text-xs text-muted-foreground">{a.purchase_date ? new Date(a.purchase_date).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                      <td className="text-xs">{assignee?.full_name ?? "Office (shared)"}</td>
                      <td className="pr-2 text-right space-x-1 whitespace-nowrap">
                        <button onClick={() => onEdit(a)} title="Edit" className="p-1 hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => onDelete(a.id)} title="Delete" className="p-1 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
  );
}
