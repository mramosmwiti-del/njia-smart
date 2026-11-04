import { Trash2, Plus } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function TabSection({ label, onAdd, children }: any) {
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" onClick={onAdd}><Plus className="h-3.5 w-3.5 mr-1" />Add {label}</Button>
      </div>
      {children}
    </div>
  );
}

export function Info({ label, value }: any) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}
export function Card({ title, children }: any) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <h3 className="font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}
export function Empty({ msg }: any) { return <p className="text-sm text-muted-foreground">{msg}</p>; }
export function RelatedList({ rows, cols, empty }: any) {
  if (!rows.length) return <div className="bg-card border rounded-lg p-8 text-center text-muted-foreground text-sm">{empty}</div>;
  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground border-b">
          <tr>{cols.map((c:string)=> <th key={c} className="py-2 px-3 capitalize">{c.replace(/_/g, " ")}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r:any) => (
            <tr key={r.id} className="border-b last:border-0">
              {cols.map((c:string) => (
                <td key={c} className="py-2 px-3">
                  {c.endsWith("_at") || c.endsWith("date") ? formatDate(r[c]) :
                    typeof r[c] === "string" ? <span className="capitalize">{r[c].replace(/_/g, " ")}</span> : r[c]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TaxList({ rows, onDelete, empty, canDelete }: any) {
  if (!rows.length) return <div className="bg-card border rounded-lg p-8 text-center text-muted-foreground text-sm">{empty}</div>;
  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground border-b">
          <tr>
            <th className="py-2 px-3">Return type</th>
            <th className="py-2 px-3">Period end</th>
            <th className="py-2 px-3">Due date</th>
            <th className="py-2 px-3">Status</th>
            {canDelete && <th className="py-2 px-3 w-10">Action</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.id} className="border-b last:border-0">
              <td className="py-2 px-3 capitalize">{r.return_type?.replace(/_/g, " ")}</td>
              <td className="py-2 px-3">{formatDate(r.period_end)}</td>
              <td className="py-2 px-3">{formatDate(r.due_date)}</td>
              <td className="py-2 px-3 capitalize">{r.status?.replace(/_/g, " ")}</td>
              {canDelete && <td className="py-2 px-3">
                <button type="button" onClick={() => onDelete(r.id)} className="text-muted-foreground hover:text-destructive p-1" aria-label="Delete filing history" title="Delete filing history">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Field({ label, children }: any) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
