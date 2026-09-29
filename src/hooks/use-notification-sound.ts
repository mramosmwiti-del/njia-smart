import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { playNotificationSound } from "@/lib/sound";

type NotificationRow = { id: string; title: string; body: string | null; link: string | null };

/**
 * Mount once (in AppShell) so a sound + a short-lived toast popup fire for
 * a brand-new notification row no matter which page you're on — chat
 * messages included, since notify_chat_message already writes a row here
 * for every message to anyone but the sender.
 */
export function useNotificationSound() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("notif-sound-" + user.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          playNotificationSound();
          const n = payload.new as NotificationRow;
          toast(n.title, {
            description: n.body ?? undefined,
            duration: 6000, // auto-dismisses after ~6s; the person can also swipe/click it away sooner
            action: n.link
              ? { label: "View", onClick: () => { window.location.href = n.link as string; } }
              : undefined,
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);
}
