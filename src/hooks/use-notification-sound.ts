import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { playNotificationSound } from "@/lib/sound";

/**
 * Mount once (in AppShell) so a sound plays for a brand-new notification
 * row no matter which page you're on — chat messages included, since the
 * notify_chat_message trigger already writes a row here for every message
 * to anyone but the sender.
 */
export function useNotificationSound() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("notif-sound-" + user.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => playNotificationSound())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);
}
