// Shared constants/helpers for the Tax module.

export const TABS = ["Overview", "Checklist", "Filing Record", "Annual Filing Record"] as const;
export const ALL_TYPES = "__all__";

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}


/** PostgREST returns at most 1000 rows per request, so read a table page by page. */
export async function fetchAll(page: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>) {
  const size = 1000;
  const out: any[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error || !data) break;
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}
