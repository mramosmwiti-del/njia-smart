import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type Options = {
  /** Skip subscribing (e.g. until the user is known). Default true. */
  enabled?: boolean;
  /** Optional postgres_changes filter, e.g. `user_id=eq.<id>`. Applied to every table listed. */
  filter?: string;
  /** Bursts of changes (CSV import, bulk edits) are merged into one refresh. Default 400ms. */
  debounceMs?: number;
};

let channelSeq = 0;

/**
 * Keep a page live without reloading it.
 *
 *   useLiveRefresh(["tasks"], load);
 *
 * Calls `refresh` (your existing load function) whenever any row changes in
 * one of the listed tables - by anyone, in any tab - and also when:
 *   - the browser tab becomes visible again, or the network comes back
 *   - the realtime socket reconnects (anything missed while offline)
 *
 * It only refreshes data; it never touches open dialogs or form state.
 * `refresh` can be a fresh closure every render - the latest one is always used.
 */
export function useLiveRefresh(
  tables: string[],
  refresh: () => void | Promise<unknown>,
  { enabled = true, filter, debounceMs = 400 }: Options = {},
) {
  const latest = useRef(refresh);
  latest.current = refresh;
  const tableKey = tables.join(",");

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { void latest.current(); }, debounceMs);
    };

    let ch = supabase.channel(`live-${tableKey.replace(/,/g, "-")}-${++channelSeq}`);
    for (const table of tableKey.split(",")) {
      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        fire,
      );
    }

    let subscribedBefore = false;
    ch.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      // First connect: the page already loaded. Any later one is a reconnect,
      // so pull whatever changed while we were disconnected.
      if (subscribedBefore) fire();
      subscribedBefore = true;
    });

    const onVisible = () => { if (document.visibilityState === "visible") fire(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", fire);
    window.addEventListener("naha:refresh", fire); // offline changes just synced

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", fire);
      window.removeEventListener("naha:refresh", fire);
      supabase.removeChannel(ch);
    };
  }, [tableKey, filter, enabled, debounceMs]);
}
