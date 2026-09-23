import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { Search, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authed/activity")({ component: ActivityPage });

const ENTITIES = ["all","clients","tasks","tax_returns","engagements","advisory_projects","advisory_milestones","announcements","audit_workpapers","audit_review_notes","documents","calendar_events","client_assignments","tax_return_assignees","user_roles","profiles"];
const ACTIONS = ["all","create","update","delete"];

function ActivityPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("all");
  const [action, setAction] = useState("all");
  const [userId, setUserId] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(500);
    const { data: profs } = await supabase.from("profiles").select("id, full_name");
    const map: Record<string, any> = {};
    (profs ?? []).forEach((p: any) => { map[p.id] = p; });
    setProfiles(map);
    setRows(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter(r => {
    if (entity !== "all" && r.entity !== entity) return false;
    if (action !== "all" && r.action !== action) return false;
    if (userId !== "all" && r.user_id !== userId) return false;
    if (q) {
      const hay = JSON.stringify(r).toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [rows, q, entity, action, userId]);

  const staffOptions = Object.values(profiles) as any[];
  const nameFor = (r: any) => r.user_name || profiles[r.user_id]?.full_name || (r.user_id ? "Unknown user" : "System");

  if (!isAdmin) {
    return <div className="max-w-2xl mx-auto mt-16 rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Activity history is restricted to admins and directors.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Activity History</h2>
          <p className="text-sm text-muted-foreground">Every create, edit and delete across the system with the responsible user.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border hover:bg-muted">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="rounded-lg border bg-card p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search field, value, id…" className="w-full pl-8 pr-3 py-2 text-sm rounded-md border bg-background" />
        </div>
        <select value={entity} onChange={e=>setEntity(e.target.value)} className="text-sm rounded-md border bg-background px-2 py-2">
          {ENTITIES.map(e => <option key={e} value={e}>{e === "all" ? "All modules" : e.replace(/_/g," ")}</option>)}
        </select>
        <select value={action} onChange={e=>setAction(e.target.value)} className="text-sm rounded-md border bg-background px-2 py-2">
          {ACTIONS.map(a => <option key={a} value={a}>{a === "all" ? "All actions" : a}</option>)}
        </select>
        <select value={userId} onChange={e=>setUserId(e.target.value)} className="text-sm rounded-md border bg-background px-2 py-2">
          <option value="all">All users</option>
          {staffOptions.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
        </select>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No activity yet.</div>
        ) : (
          <ul className="divide-y">
            {filtered.map(r => {
              const who = nameFor(r);
              const open = expanded[r.id];
              return (
                <li key={r.id} className="p-3 hover:bg-muted/40">
                  <button onClick={()=>setExpanded(x=>({ ...x, [r.id]: !x[r.id] }))} className="w-full flex items-start gap-3 text-left">
                    {open ? <ChevronDown className="h-4 w-4 mt-1 shrink-0" /> : <ChevronRight className="h-4 w-4 mt-1 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        <span className="font-medium">{who}</span>{" "}
                        <ActionBadge action={r.action} />{" "}
                        <span className="text-muted-foreground">on</span>{" "}
                        <span className="font-mono text-xs">{r.entity}</span>
                        {r.entity_id && <span className="text-xs text-muted-foreground"> · {String(r.entity_id).slice(0,8)}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{formatDate(r.created_at)} · {new Date(r.created_at).toLocaleTimeString()}</div>
                      {open && r.meta && (
                        <pre className="mt-2 text-xs bg-muted rounded p-2 overflow-x-auto max-h-64">{JSON.stringify(r.meta, null, 2)}</pre>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="text-xs text-muted-foreground">Showing latest {filtered.length} of {rows.length} recent events (last 500 loaded).</div>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const cls = action === "create" ? "bg-emerald-100 text-emerald-800" : action === "update" ? "bg-blue-100 text-blue-800" : action === "delete" ? "bg-red-100 text-red-800" : "bg-muted";
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${cls}`}>{action}</span>;
}
