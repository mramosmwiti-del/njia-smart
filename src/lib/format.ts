export function formatDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
}
export function daysUntil(d?: string | null) {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  return diff;
}
export const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  waiting_for_documents: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  under_review: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  filed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  urgent: "bg-accent/20 text-accent",
  pending: "bg-muted text-muted-foreground",
  todo: "bg-muted text-muted-foreground",
  blocked: "bg-red-100 text-red-800",
  done: "bg-emerald-100 text-emerald-800",
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-100 text-blue-800",
  high: "bg-amber-100 text-amber-800",
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};
export function statusLabel(s: string) {
  return s.replace(/_/g, " ");
}
