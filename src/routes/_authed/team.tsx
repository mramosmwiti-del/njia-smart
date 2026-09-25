import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth, ROLE_LABELS, type AppRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createStaff } from "@/lib/admin.functions";
import { Plus, X, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authed/team")({ component: TeamPage });

const ROLES: AppRole[] = ["director","admin","audit_manager","tax_consultant","advisory_officer","accountant","accounts_assistant","intern","marketing","tax_assistant","audit_assistant","internal_admin"];
const EMPTY = { email:"", password:"", full_name:"", department:"", phone:"", role:"accountant" as AppRole };

function TeamPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const create = useServerFn(createStaff);

  async function load() {
    const { data: profiles } = await supabase.from("profiles").select("*").order("created_at");
    const { data: roles } = await supabase.from("user_roles").select("*");
    const byUser: Record<string, string[]> = {};
    (roles ?? []).forEach((r:any)=>{ (byUser[r.user_id] ??= []).push(r.role); });
    setRows((profiles ?? []).map((p:any)=>({ ...p, roles: byUser[p.id] || [] })));
  }
  useEffect(()=>{ load(); }, []);

  async function setRole(userId: string, role: AppRole, on: boolean) {
    if (on) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) toast.error(error.message); else { toast.success(`${ROLE_LABELS[role]} granted`); load(); }
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) toast.error(error.message); else { toast.success("Role removed"); load(); }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: form });
      toast.success(`${form.full_name} added. They can sign in with the email and password you set.`);
      setOpen(false); setForm(EMPTY); load();
    } catch (err: any) {
      toast.error(err.message || "Failed to create staff");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-3 items-center">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-sm text-muted-foreground">Manage staff accounts and roles.</p>
        </div>
        {isAdmin && (
          <button onClick={()=>setOpen(true)} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Create staff
          </button>
        )}
      </div>
      {!isAdmin && <div className="bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-100 rounded-md p-3 text-sm">Only Directors and Admins can change roles.</div>}
      <div className="grid gap-3">
        {rows.map(p=>{
          const label = p.full_name ? `${p.full_name}'s profile` : "View profile";
          return (
            <Link
              key={p.id}
              to="/team/$id"
              params={{ id: p.id }}
              aria-label={label}
              className="group bg-card border rounded-lg p-4 hover:border-primary/50 transition-colors block"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold group-hover:text-primary">{p.full_name || "Unnamed"}</div>
                  <div className="text-xs text-muted-foreground">{p.department || "—"} · Joined {formatDate(p.created_at)}</div>
                </div>
                <div className="flex flex-wrap gap-1 max-w-md">
                  {ROLES.map(r=>{
                    const on = p.roles.includes(r);
                    return (
                      <button
                        type="button"
                        key={r}
                        disabled={!isAdmin}
                        onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setRole(p.id, r, !on); }}
                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:border-primary/50"} ${!isAdmin?"opacity-60 cursor-not-allowed":""}`}
                      >{ROLE_LABELS[r]}</button>
                    );
                  })}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={()=>setOpen(false)}>
          <form onClick={e=>e.stopPropagation()} onSubmit={submit} className="bg-card w-full max-w-md rounded-lg p-6 space-y-3">
            <div className="flex justify-between"><h2 className="text-lg font-semibold">Create staff account</h2><button type="button" onClick={()=>setOpen(false)}><X className="h-4 w-4" /></button></div>
            <p className="text-xs text-muted-foreground">An account is created immediately. Share the password securely with the new staff member.</p>
            <input required placeholder="Full name" value={form.full_name} onChange={e=>setForm({...form, full_name:e.target.value})} className="w-full h-9 px-3 rounded-md border bg-background text-sm" />
            <input required type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} className="w-full h-9 px-3 rounded-md border bg-background text-sm" />
            <input required type="text" placeholder="Temporary password (min 8 chars)" minLength={8} value={form.password} onChange={e=>setForm({...form, password:e.target.value})} className="w-full h-9 px-3 rounded-md border bg-background text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Department" value={form.department} onChange={e=>setForm({...form, department:e.target.value})} className="h-9 px-3 rounded-md border bg-background text-sm" />
              <input placeholder="Phone" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} className="h-9 px-3 rounded-md border bg-background text-sm" />
            </div>
            <select value={form.role} onChange={e=>setForm({...form, role:e.target.value as AppRole})} className="w-full h-9 px-3 rounded-md border bg-background text-sm">
              {ROLES.map(r=><option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <button disabled={busy} className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium">{busy ? "Creating…" : "Create staff"}</button>
          </form>
        </div>
      )}
    </div>
  );
}
