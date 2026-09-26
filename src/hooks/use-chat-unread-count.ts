import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Count of unread chat notifications (type = 'chat_message') for the
 * current user, kept live via the same notifications table the bell uses.
 * Chat marks its own notifications read as channels are opened
 * (see chat.tsx), so this naturally clears per-channel.
 */
export function useChatUnreadCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  async function load() {
    if (!user) { setCount(0); return; }
    const { count: c } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("type", "chat_message")
      .is("read_at", null);
    setCount(c ?? 0);
  }

  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("chat-unread-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  return count;
}
