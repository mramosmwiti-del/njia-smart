// Week helpers and workload levels for task planning. Weeks run Monday to Sunday
// and are identified by their Monday as "YYYY-MM-DD".

/** Open tasks planned in one week for one person: this many is "busy". */
export const WEEK_BUSY = 3;
/** ... and this many is "overloaded". Change these two numbers to retune the plan. */
export const WEEK_OVERLOADED = 5;

/** Key for tasks that have neither a planned week nor a due date. */
export const NO_WEEK = "none";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function toISO(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function parse(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Monday of the week containing the given day (date string or Date). */
export function mondayOf(input?: string | Date | null): string | null {
  if (!input) return null;
  const d = typeof input === "string" ? parse(input) : new Date(input.getFullYear(), input.getMonth(), input.getDate());
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISO(d);
}

export function addWeeks(iso: string, n: number) {
  const d = parse(iso);
  d.setDate(d.getDate() + 7 * n);
  return toISO(d);
}

/** "9–15 Nov 2026" or "28 Nov – 4 Dec 2026". */
export function weekLabel(iso: string) {
  if (iso === NO_WEEK) return "No week";
  const s = parse(iso);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  const sameMonth = s.getMonth() === e.getMonth();
  const start = sameMonth ? `${s.getDate()}` : `${s.getDate()} ${MONTHS[s.getMonth()]}`;
  return `${start}–${e.getDate()} ${MONTHS[e.getMonth()]} ${e.getFullYear()}`.replace("–", sameMonth ? "–" : " – ");
}

/** The week a task counts in: its planned week, else the week of its due date. */
export function weekOf(t: { week_start?: string | null; due_date?: string | null }) {
  return t.week_start ?? mondayOf(t.due_date) ?? NO_WEEK;
}

export type LoadLevel = "free" | "light" | "busy" | "overloaded";

export function loadLevel(openTasks: number): LoadLevel {
  if (openTasks <= 0) return "free";
  if (openTasks < WEEK_BUSY) return "light";
  if (openTasks < WEEK_OVERLOADED) return "busy";
  return "overloaded";
}

export const LEVEL_LABEL: Record<LoadLevel, string> = {
  free: "Free", light: "Light", busy: "Busy", overloaded: "Overloaded",
};

export const LEVEL_CLS: Record<LoadLevel, string> = {
  free: "bg-muted text-muted-foreground",
  light: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  busy: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-100",
  overloaded: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};
