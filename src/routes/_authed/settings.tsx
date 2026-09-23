import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth, ROLE_LABELS } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authed/settings")({ component: Settings });

function Settings() {
  const { user, roles, isAdmin } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setProfile(data);
    if (isAdmin) {
      const { data: a } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(20);
      setActivity(a ?? []);
    }
  }
  useEffect(()=>{ load(); }, [user, isAdmin]);

  async function saveProfile() {
    const { error } = await supabase.from("profiles").update({ full_name: profile.full_name, department: profile.department, phone: profile.phone }).eq("id", user!.id);
    if (error) toast.error(error.message); else toast.success("Profile updated");
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
    </div>
  );
}
