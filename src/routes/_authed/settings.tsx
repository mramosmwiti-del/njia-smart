import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Plus } from "lucide-react";
import { useAuth, ROLE_LABELS } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authed/settings")({ component: Settings });

const CADENCES = ["monthly", "quarterly", "annual"] as const;

function Settings() {
  const { user, roles, isAdmin } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<any>({});
  const [addingPolicy, setAddingPolicy] = useState(false);
  const [newPolicy, setNewPolicy] = useState<any>({ tax_type: "", label: "", cadence: "monthly", due_day: 20 });

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setProfile(data);
    if (isAdmin) {
      const { data: a } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(20);
      setActivity(a ?? []);
      const { data: p } = await supabase.from("tax_policies").select("*").order("sort_order");
      setPolicies((p as any[]) ?? []);
    }
  }
  useEffect(()=>{ load(); }, [user, isAdmin]);

  async function saveProfile() {
    const { error } = await supabase.from("profiles").update({ full_name: profile.full_name, department: profile.department, phone: profile.phone }).eq("id", user!.id);
    if (error) toast.error(error.message); else toast.success("Profile updated");
  }

  function startEdit(p: any) {
    setEditingType(p.tax_type);
    setEditRow({ label: p.label, cadence: p.cadence, due_day: p.due_day, active: p.active });
  }
  async function savePolicyEdit(taxType: string) {
    const { error } = await supabase.from("tax_policies").update({
      label: editRow.label, cadence: editRow.cadence, due_day: Number(editRow.due_day) || 20, active: !!editRow.active,
    }).eq("tax_type", taxType);
    if (error) toast.error(error.message);
    else { toast.success("Policy saved"); setEditingType(null); load(); }
  }
  async function addPolicy() {
    const key = newPolicy.tax_type.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key || !newPolicy.label.trim()) { toast.error("Type key and label are required"); return; }
    const { error } = await supabase.from("tax_policies").insert({
      tax_type: key, label: newPolicy.label.trim(), cadence: newPolicy.cadence,
      due_day: Number(newPolicy.due_day) || 20, sort_order: policies.length + 1,
    } as any);
    if (error) toast.error(error.message);
    else {
      toast.success("Tax type added");
      setAddingPolicy(false);
      setNewPolicy({ tax_type: "", label: "", cadence: "monthly", due_day: 20 });
      load();
    }
  }

  if (!profile) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <div><h1 className="text-2xl font-bold">Settings</h1><p className="text-sm text-muted-foreground">Your profile and firm activity.</p></div>
      <div className="bg-card border rounded-lg p-5 space-y-3">
        <h2 className="font-semibold">Profile</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="text-xs">Full name</label><input value={profile.full_name||""} onChange={e=>setProfile({...profile, full_name:e.target.value})} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm" /></div>
          <div><label className="text-xs">Department</label><input value={profile.department||""} onChange={e=>setProfile({...profile, department:e.target.value})} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm" /></div>
          <div><label className="text-xs">Phone</label><input value={profile.phone||""} onChange={e=>setProfile({...profile, phone:e.target.value})} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm" /></div>
          <div><label className="text-xs">Email</label><input disabled value={user?.email||""} className="mt-1 w-full h-9 px-3 rounded-md border bg-muted text-sm text-muted-foreground" /></div>
        </div>
        <div><label className="text-xs">Roles</label><div className="mt-1 flex flex-wrap gap-1">{roles.map(r=><span key={r} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">{ROLE_LABELS[r]}</span>)}</div></div>
        <button onClick={saveProfile} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium">Save profile</button>
      </div>

      {isAdmin && (
        <div className="bg-card border rounded-lg p-5">
          <h2 className="font-semibold mb-3">Recent activity</h2>
          {activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> :
            <div className="space-y-1 text-sm">
              {activity.map((a:any)=>(
                <div key={a.id} className="flex justify-between py-1 border-b last:border-0">
                  <span>{a.action} <span className="text-muted-foreground">{a.entity}</span></span>
                  <span className="text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
                </div>
              ))}
            </div>
          }
        </div>
      )}

      {isAdmin && (
        <div className="bg-card border rounded-lg p-5 space-y-3">
          <div>
            <h2 className="font-semibold">Tax policies</h2>
            <p className="text-xs text-muted-foreground">Controls which tax types appear under Tax, their cadence and due day. Not visible elsewhere in the app.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground border-b">
                <tr><th className="py-2 px-3">Tax type</th><th className="py-2 px-3">Label</th><th className="py-2 px-3">Cadence</th><th className="py-2 px-3">Due day</th><th className="py-2 px-3">Active</th><th className="py-2 px-3 w-24"></th></tr>
              </thead>
              <tbody>
                {policies.map(p => {
                  const editing = editingType === p.tax_type;
                  return (
                    <tr key={p.tax_type} className="border-b last:border-0">
                      <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{p.tax_type}</td>
                      <td className="py-2 px-3">
                        {editing ? <input value={editRow.label} onChange={e => setEditRow({ ...editRow, label: e.target.value })} className="h-8 px-2 rounded border bg-background text-sm w-40" /> : p.label}
                      </td>
                      <td className="py-2 px-3">
                        {editing ? (
                          <select value={editRow.cadence} onChange={e => setEditRow({ ...editRow, cadence: e.target.value })} className="h-8 px-2 rounded border bg-background text-sm capitalize">
                            {CADENCES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        ) : <span className="capitalize">{p.cadence}</span>}
                      </td>
                      <td className="py-2 px-3">
                        {editing ? <input type="number" min={1} max={31} value={editRow.due_day} onChange={e => setEditRow({ ...editRow, due_day: e.target.value })} className="h-8 w-16 px-2 rounded border bg-background text-sm" /> : p.due_day}
                      </td>
                      <td className="py-2 px-3">
                        {editing ? <input type="checkbox" checked={!!editRow.active} onChange={e => setEditRow({ ...editRow, active: e.target.checked })} /> : (p.active ? "Yes" : "No")}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        {editing ? (
                          <div className="inline-flex gap-2">
                            <button onClick={() => savePolicyEdit(p.tax_type)} className="text-primary text-xs inline-flex items-center gap-1"><Save className="h-3 w-3" />Save</button>
                            <button onClick={() => setEditingType(null)} className="text-muted-foreground text-xs">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(p)} className="text-primary text-xs">Edit</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {addingPolicy ? (
            <div className="bg-muted/20 border rounded-lg p-3 grid sm:grid-cols-5 gap-2 items-end">
              <div>
                <label className="text-xs font-medium">Type key</label>
                <input placeholder="e.g. digital_service_tax" value={newPolicy.tax_type} onChange={e => setNewPolicy({ ...newPolicy, tax_type: e.target.value })} className="mt-1 w-full h-9 px-2 rounded-md border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Label</label>
                <input value={newPolicy.label} onChange={e => setNewPolicy({ ...newPolicy, label: e.target.value })} className="mt-1 w-full h-9 px-2 rounded-md border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Cadence</label>
                <select value={newPolicy.cadence} onChange={e => setNewPolicy({ ...newPolicy, cadence: e.target.value })} className="mt-1 w-full h-9 px-2 rounded-md border bg-background text-sm capitalize">
                  {CADENCES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Due day</label>
                <input type="number" min={1} max={31} value={newPolicy.due_day} onChange={e => setNewPolicy({ ...newPolicy, due_day: e.target.value })} className="mt-1 w-full h-9 px-2 rounded-md border bg-background text-sm" />
              </div>
              <div className="flex gap-2">
                <button onClick={addPolicy} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm">Add</button>
                <button onClick={() => setAddingPolicy(false)} className="h-9 px-3 rounded-md border text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingPolicy(true)} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-2"><Plus className="h-4 w-4" /> Add tax type</button>
          )}
        </div>
      )}
    </div>
  );
}
