import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Save, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ObligationContacts({ clientId, taxType, label }: { clientId: string; taxType: string; label: string }) {
  const [login, setLogin] = useState<any>({ login_email: "", login_password: "" });
  const [contacts, setContacts] = useState<any[]>([]);
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "" });
  const [open, setOpen] = useState(false);

  async function load() {
    const [l, c] = await Promise.all([
      supabase.from("client_obligation_logins").select("*").eq("client_id", clientId).eq("tax_type", taxType).maybeSingle(),
      supabase.from("client_obligation_contacts").select("*").eq("client_id", clientId).eq("tax_type", taxType).order("created_at"),
    ]);
    setLogin(l.data ?? { login_email: "", login_password: "" });
    setContacts(c.data ?? []);
  }
  useEffect(() => { if (open) load(); }, [open, clientId, taxType]);

  async function saveLogin() {
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("client_obligation_logins").upsert({
      client_id: clientId, tax_type: taxType,
      login_email: login.login_email || null,
      login_password: login.login_password || null,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Portal login saved");
  }

  async function addContact() {
    if (!newContact.name.trim()) { toast.error("Contact name required"); return; }
    setBusy(true);
    const { error } = await supabase.from("client_obligation_contacts").insert({
      client_id: clientId, tax_type: taxType,
      name: newContact.name, email: newContact.email || null, phone: newContact.phone || null,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { setNewContact({ name: "", email: "", phone: "" }); load(); }
  }

  async function removeContact(id: string) {
    const { error } = await supabase.from("client_obligation_contacts").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  }

  return (
    <div className="border rounded-lg">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium">
        <span className="uppercase">{label} — portal access &amp; contacts</span>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="p-3 pt-0 space-y-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Portal login (e.g. iTax, NSSF, SHA)</div>
            <div className="grid sm:grid-cols-2 gap-2">
              <Input placeholder="Login email / username" value={login.login_email ?? ""} onChange={e => setLogin({ ...login, login_email: e.target.value })} />
              <div className="flex items-center gap-1">
                <Input type={showPwd ? "text" : "password"} placeholder="Login password" value={login.login_password ?? ""} onChange={e => setLogin({ ...login, login_password: e.target.value })} className="font-mono" />
                <button type="button" onClick={() => setShowPwd(s => !s)} className="text-muted-foreground hover:text-foreground p-1 shrink-0" aria-label={showPwd ? "Hide" : "Show"}>
                  {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <Button size="sm" variant="outline" className="mt-2" onClick={saveLogin} disabled={busy}><Save className="h-3.5 w-3.5 mr-1" />Save login</Button>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-1">Additional contacts for this obligation</div>
            {contacts.length === 0 && <p className="text-xs text-muted-foreground mb-2">No contacts added yet.</p>}
            <div className="space-y-1 mb-2">
              {contacts.map(c => (
                <div key={c.id} className="flex items-center justify-between text-sm bg-muted/30 rounded px-2 py-1">
                  <span>{c.name} <span className="text-xs text-muted-foreground">{c.email} {c.phone && `· ${c.phone}`}</span></span>
                  <button type="button" onClick={() => removeContact(c.id)} className="text-muted-foreground hover:text-destructive p-1" aria-label="Remove contact"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-4 gap-2">
              <Input placeholder="Name" value={newContact.name} onChange={e => setNewContact({ ...newContact, name: e.target.value })} />
              <Input placeholder="Email" value={newContact.email} onChange={e => setNewContact({ ...newContact, email: e.target.value })} />
              <Input placeholder="Phone" value={newContact.phone} onChange={e => setNewContact({ ...newContact, phone: e.target.value })} />
              <Button size="sm" variant="outline" onClick={addContact} disabled={busy}><Plus className="h-3.5 w-3.5 mr-1" />Add</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
