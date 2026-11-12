import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Marks incoming chat messages as "delivered" while the app is open, on any
 * page (not only Chat). That is what turns a sender's single tick into two.
 * Runs when the app loads, when a message arrives, and when the device comes
 * back online or the tab becomes visible again. Failures are ignored on
 * purpose: a missed delivery marker must never disturb the user.
 */
export function useChatDelivery() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void supabase.rpc("chat_mark_delivered" as any).then(() => {}, () => {});
      }, 400);
    };
    const onVisible = () => { if (document.visibilityState === "visible") run(); };

    run();
    const ch = supabase
      .channel("chat-delivery-" + user.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        if ((payload.new as any)?.sender_id !== user.id) run();
      })
      .subscribe();
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(ch);
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id]);
}
