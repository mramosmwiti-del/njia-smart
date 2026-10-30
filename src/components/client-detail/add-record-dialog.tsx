import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TASK_PRIORITIES } from "./constants";
import { Field } from "./helpers";
import type { ClientDetailCtx } from "./use-client-detail";

export function AddRecordDialog({ ctx }: { ctx: ClientDetailCtx }) {
  const { taxPolicies, addOpen, setAddOpen, addForm, setAddForm, addBusy, setAddFile, submitAdd } = ctx;
  return (
    <>
      <Dialog open={!!addOpen} onOpenChange={(o)=>!o && setAddOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="capitalize">Add {addOpen}</DialogTitle></DialogHeader>
          {addOpen === "tax" && (
            <div className="space-y-3">
              <Field label="Tax obligations * (select one or more)">
                {taxPolicies.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">No active tax policies configured yet — an admin can add types under Settings first.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 border rounded-md bg-background">
                    {taxPolicies.map(p => {
                      const selected = (addForm.return_types ?? []).includes(p.tax_type);
                      return (
                        <label key={p.tax_type} title={`${p.cadence}, due day ${p.due_day}`} className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs ${selected ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={e => {
                              const cur: string[] = addForm.return_types ?? [];
                              setAddForm({ ...addForm, return_types: e.target.checked ? [...cur, p.tax_type] : cur.filter((x: string) => x !== p.tax_type) });
                            }}
                          />
                          {p.label}
                        </label>
                      );
                    })}
                  </div>
                )}
              </Field>
              <p className="text-xs text-muted-foreground">
                Due dates aren't set here — each type follows its own tax policy (cadence and due day, managed by admins under Settings), so the first filing is scheduled automatically.
              </p>
            </div>
          )}
          {(addOpen === "audit" || addOpen === "advisory") && (
            <div className="space-y-3">
              <Field label="Title *"><Input value={addForm.title ?? ""} onChange={e=>setAddForm({...addForm, title: e.target.value})} /></Field>
              <Field label="Due date"><Input type="date" value={addForm.due_date ?? ""} onChange={e=>setAddForm({...addForm, due_date: e.target.value})} /></Field>
              {addOpen === "advisory"
                ? <Field label="Description"><Textarea rows={3} value={addForm.description ?? ""} onChange={e=>setAddForm({...addForm, description: e.target.value})} /></Field>
                : <Field label="Notes"><Textarea rows={3} value={addForm.notes ?? ""} onChange={e=>setAddForm({...addForm, notes: e.target.value})} /></Field>}
            </div>
          )}
          {addOpen === "document" && (
            <div className="space-y-3">
              <Field label="Title"><Input value={addForm.title ?? ""} onChange={e=>setAddForm({...addForm, title: e.target.value})} placeholder="Defaults to filename" /></Field>
              <Field label="File *"><Input type="file" onChange={e=>setAddFile(e.target.files?.[0] ?? null)} /></Field>
            </div>
          )}
          {addOpen === "task" && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><Field label="Title *"><Input value={addForm.title ?? ""} onChange={e=>setAddForm({...addForm, title: e.target.value})} /></Field></div>
              <Field label="Priority">
                <select value={addForm.priority} onChange={e=>setAddForm({...addForm, priority: e.target.value})} className="h-9 w-full px-3 rounded-md border bg-background text-sm capitalize">
                  {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Due date"><Input type="date" value={addForm.due_date ?? ""} onChange={e=>setAddForm({...addForm, due_date: e.target.value})} /></Field>
              <div className="sm:col-span-2"><Field label="Description"><Textarea rows={3} value={addForm.description ?? ""} onChange={e=>setAddForm({...addForm, description: e.target.value})} /></Field></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={()=>setAddOpen(null)}>Cancel</Button>
            <Button onClick={submitAdd} disabled={addBusy}>{addBusy ? "Saving…" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
