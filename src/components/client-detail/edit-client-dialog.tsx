import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Field } from "./helpers";
import type { ClientDetailCtx } from "./use-client-detail";

export function EditClientDialog({ ctx }: { ctx: ClientDetailCtx }) {
  const { editOpen, setEditOpen, form, setForm, saveEdit } = ctx;
  return (
    <>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit client</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Type">
              <select value={form.client_type ?? "company"} onChange={e=>setForm({...form, client_type: e.target.value})} className="h-9 w-full px-3 rounded-md border bg-background text-sm">
                <option value="company">Company</option>
                <option value="individual">Individual</option>
              </select>
            </Field>
            <Field label={form.client_type === "individual" ? "Display name *" : "Company name *"}>
              <Input value={form.company_name ?? ""} onChange={e=>setForm({...form, company_name: e.target.value})} />
            </Field>
            {form.client_type === "individual" && <>
              <Field label="First name"><Input value={form.first_name ?? ""} onChange={e=>setForm({...form, first_name: e.target.value})} /></Field>
              <Field label="Last name"><Input value={form.last_name ?? ""} onChange={e=>setForm({...form, last_name: e.target.value})} /></Field>
              <Field label="ID / Passport #"><Input value={form.id_number ?? ""} onChange={e=>setForm({...form, id_number: e.target.value})} /></Field>
            </>}
            <Field label="KRA PIN"><Input value={form.kra_pin ?? ""} onChange={e=>setForm({...form, kra_pin: e.target.value})} /></Field>
            
            <Field label="Industry"><Input value={form.industry ?? ""} onChange={e=>setForm({...form, industry: e.target.value})} /></Field>
            <Field label="Engagement type"><Input value={form.engagement_type ?? ""} onChange={e=>setForm({...form, engagement_type: e.target.value})} /></Field>
            <Field label="Email"><Input type="email" value={form.email ?? ""} onChange={e=>setForm({...form, email: e.target.value})} /></Field>
            <Field label="Phone"><Input value={form.phone ?? ""} onChange={e=>setForm({...form, phone: e.target.value})} /></Field>
          </div>
          <Field label="Notes"><Textarea rows={3} value={form.notes ?? ""} onChange={e=>setForm({...form, notes: e.target.value})} /></Field>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
