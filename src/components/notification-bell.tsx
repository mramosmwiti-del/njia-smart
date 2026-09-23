import { useEffect, useRef, useState } from "react";
import { Bell, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("notifications").select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems(data ?? []);
  }

  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("notif-"+user.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unread = items.filter(i => !i.read_at).length;

  async function markAll() {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() })
      .eq("user_id", user!.id).is("read_at", null);
    load();
  }
  async function markOne(id: string) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    load();
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={()=>setOpen(o=>!o)} className="relative p-2 rounded-md hover:bg-muted">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 bg-accent text-accent-foreground text-[10px] rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto bg-card border rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between p-3 border-b">
            <div className="font-semibold text-sm">Notifications</div>
            {unread > 0 && <button onClick={markAll} className="text-xs text-primary hover:underline">Mark all read</button>}
          </div>
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
          ) : items.map(n => (
            <div key={n.id} className={`p-3 border-b last:border-0 text-sm ${!n.read_at ? "bg-accent/5" : ""}`}>
              <div className="flex justify-between gap-2">
                <div className="font-medium">{n.title}</div>
                {!n.read_at && <button onClick={()=>markOne(n.id)} title="Mark read"><Check className="h-3 w-3 text-muted-foreground hover:text-primary" /></button>}
              </div>
              {n.body && <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>}
              <div className="text-[10px] text-muted-foreground mt-1">{formatDate(n.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
