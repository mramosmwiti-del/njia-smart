// Shared constants and helpers for the Task Workspace.

export type UpdateKind = "note" | "feedback" | "report" | "guidance" | "system";
export type WorkspaceTab = "overview" | "subtasks" | "notes" | "outputs" | "timeline";

export const KIND_LABEL: Record<UpdateKind, string> = {
  note: "Note",
  feedback: "Feedback",
  report: "Progress report",
  guidance: "Guidance",
  system: "Activity",
};

export const KIND_CLS: Record<UpdateKind, string> = {
  note: "bg-muted text-foreground",
  feedback: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  report: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  guidance: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  system: "bg-muted text-muted-foreground",
};

export const GUIDANCE_ACTIONS: { value: string; label: string }[] = [
  { value: "continue", label: "Continue as planned" },
  { value: "approved", label: "Approved" },
  { value: "changes_requested", label: "Changes requested" },
];

export const ACTION_LABEL: Record<string, string> = Object.fromEntries(GUIDANCE_ACTIONS.map(a => [a.value, a.label]));

export const TASK_STATUSES = ["todo", "in_progress", "waiting_on_client", "blocked", "done"] as const;

/** Waiting on the client (not on us): not counted as overdue against the assignee. */
export const isWaitingOnClient = (task: any) => task?.status === "waiting_on_client";

/** Whole days the task has been waiting on the client. */
export function waitingDays(task: any): number | null {
  if (!isWaitingOnClient(task) || !task.waiting_since) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(task.waiting_since).getTime()) / 86400000));
}

/** The date to chase the client has arrived (or passed). */
export function chaseDue(task: any): boolean {
  if (!isWaitingOnClient(task) || !task.follow_up_on) return false;
  return String(task.follow_up_on).slice(0, 10) <= new Date().toISOString().slice(0, 10);
}

/** Progress shown to people: a finished task is always 100%. */
export function displayProgress(task: any): number {
  if (!task) return 0;
  if (task.status === "done") return 100;
  const n = Number(task.progress ?? 0);
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
}

/** Runs the task: Director/Admin, the assignee, the giver or the supervisor. */
export function isLeadOf(task: any, userId?: string | null, isAdmin?: boolean): boolean {
  if (!task || !userId) return false;
  return !!isAdmin || task.assigned_to === userId || task.created_by === userId || task.supervisor_id === userId;
}

/** Supervisor side: may give guidance. */
export function isSupervisorOf(task: any, userId?: string | null, isAdmin?: boolean): boolean {
  if (!task || !userId) return false;
  return !!isAdmin || task.created_by === userId || task.supervisor_id === userId;
}

/** People to tell about something that happened on the task (never yourself). */
export function peopleToNotify(task: any, exceptUserId?: string | null): string[] {
  const ids = [task?.assigned_to, task?.supervisor_id, task?.created_by].filter(Boolean) as string[];
  return [...new Set(ids)].filter(id => id !== exceptUserId);
}

export function safeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
}
