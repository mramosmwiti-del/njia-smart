import { useSyncExternalStore } from "react";
import { getSnapshot, getServerSnapshot, subscribe, type OfflineSnapshot } from "@/lib/offline/status";

/** Live offline state: online, pending changes, failed changes, syncing. */
export function useOfflineStatus(): OfflineSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
