import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus, X, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";

type Assn = { id: string; user_id: string; role_on_engagement: string | null; assigned_by?: string | null; profile?: { full_name: string | null } | null };

export function ClientAssignments({ clientId, compact = false }: { clientId: string; compact?: boolean }) {
  const { user, isAdmin } = useAuth();
  const [rows, setRows] = useState<Assn[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");

  async function load() {
    const [aRes, pRes] = await Promise.all([
      supabase.from("client_assignments").select("*").eq("client_id", clientId),
      supabase.from("profiles").select("id, full_name").order("full_name"),
    ]);
    const profs = pRes.data ?? [];
    setProfiles(profs);
    const byId = new Map(profs.map((p: any) => [p.id, p]));
    setRows((aRes.data ?? []).map((r: any) => ({ ...r, profile: byId.get(r.user_id) ?? null })));
  }
  useEffect(() => { if (clientId) load(); }, [clientId]);

  async function add() {
    if (!userId) return;
    const { error } = await supabase.from("client_assignments").insert({ client_id: clientId, user_id: userId, role_on_engagement: role || null, assigned_by: user?.id ?? null });
    if (error) return toast.error(error.message);

    const { data: client } = await supabase.from("clients").select("company_name").eq("id", clientId).maybeSingle();
    const clientName = client?.company_name;

    // Give the assignee a task so it shows up on their dashboard / task list.
    await supabase.from("tasks").insert({
      title: clientName ? `New client assignment: ${clientName}` : "New client assignment",
      description: role ? `Added as ${role} on this client's engagement team.` : "Added to this client's engagement team.",
      client_id: clientId,
      assigned_to: userId,
      status: "todo",
      priority: "normal",
      created_by: user?.id ?? null,
    });

    if (userId !== user?.id) {
      await supabase.from("notifications").insert({
        user_id: userId, type: "client_assigned",
        title: "Assigned to a client",
        body: clientName ? `You were assigned to ${clientName}${role ? ` as ${role}` : ""}` : "You were assigned to a client",
        link: `/clients/${clientId}`,
      });
    }
    setUserId(""); setRole(""); setOpen(false); load();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("client_assignments").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  }
  function canRemove(r: Assn) {
    return isAdmin || r.assigned_by == null || r.assigned_by === user?.id;
  }

  const available = profiles.filter(p => !rows.some(r => r.user_id === p.id));

  if (compact) {
    if (rows.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {rows.slice(0, 3).map(r => (
          <span key={r.id} className="text-xs px-1.5 py-0.5 rounded bg-muted">{r.profile?.full_name ?? "?"}</span>
        ))}
        {rows.length > 3 && <span className="text-xs text-muted-foreground">+{rows.length - 3}</span>}
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold inline-flex items-center gap-2"><Users className="h-4 w-4" /> Assigned staff</h3>
        <button onClick={() => setOpen(o => !o)} className="text-xs text-primary inline-flex items-center gap-1"><UserPlus className="h-3 w-3" /> Assign</button>
      </div>
      {open && (
        <div className="flex flex-wrap gap-2 mb-3 p-2 border rounded-md bg-muted/30">
          <select value={userId} onChange={e => setUserId(e.target.value)} className="h-8 px-2 rounded border bg-background text-sm flex-1 min-w-[140px]">
            <option value="">Select staff…</option>
            {available.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
          <input value={role} onChange={e => setRole(e.target.value)} placeholder="Role (e.g. Lead, Reviewer)" className="h-8 px-2 rounded border bg-background text-sm flex-1 min-w-[140px]" />
          <button onClick={add} className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs">Add</button>
        </div>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No one assigned yet.</p>
      ) : (
        <div className="space-y-1">
          {rows.map(r => (
            <div key={r.id} className="flex items-center justify-between text-sm py-1">
              <div>
                <span className="font-medium">{r.profile?.full_name ?? "Unknown"}</span>
                {r.role_on_engagement && <span className="text-xs text-muted-foreground ml-2">{r.role_on_engagement}</span>}
              </div>
              {canRemove(r) && <button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
