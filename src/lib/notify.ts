import { supabase } from "@/integrations/supabase/client";

export type NotifyInput = {
  user_id: string | null | undefined;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
};

/**
 * Sends an in-app notification to one user. Fire-and-forget on purpose: a failed
 * notification must never block or undo the action that triggered it.
 */
export async function notifyUser(n: NotifyInput) {
  if (!n.user_id) return;
  await supabase.from("notifications").insert(n as any);
}
