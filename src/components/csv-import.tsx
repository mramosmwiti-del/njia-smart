import { useRef, useState } from "react";
import Papa from "papaparse";
import { Upload, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type FieldDef = { key: string; label: string; required?: boolean; type?: "date" | "number" | "text" };

interface Props {
  table: string;
  fields: FieldDef[];
  /** Extra columns added to every row (e.g. { created_by: uid }) */
  enrich?: (row: Record<string, any>) => Record<string, any>;
  /** Optional pre-insert transform of a row */
  transform?: (row: Record<string, any>) => Record<string, any>;
  /** If true, accept a column mapped to "client_id" that contains the company NAME and resolve it to an id */
  resolveClientByName?: boolean;
  onDone?: () => void;
  trigger?: React.ReactNode;
}

// Robust date normalizer: accepts ISO, DD/MM/YYYY, D-M-YY, "Jan 5 2025",
// Excel serial numbers, and returns ISO YYYY-MM-DD or null.
function normalizeDate(input: any): string | null {
  if (input == null || input === "") return null;
  if (typeof input === "number" || /^\d{5}$/.test(String(input).trim())) {
    // Excel serial date (days since 1899-12-30)
    const n = Number(input);
    if (!isNaN(n) && n > 1000 && n < 100000) {
      const ms = (n - 25569) * 86400 * 1000;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  const s = String(input).trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD/MM/YYYY or DD-MM-YYYY (Kenya/EU default)
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (m) {
    let [_, a, b, y] = m;
    let day = parseInt(a, 10);
    let mon = parseInt(b, 10);
    // Heuristic: if first part > 12, it's definitely day-first; otherwise assume DD/MM
    if (day > 12 && mon <= 12) { /* day-first confirmed */ }
    else if (mon > 12 && day <= 12) { const t = day; day = mon; mon = t; }
    const year = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10);
    if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  // Fallback parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export function CsvImport({ table, fields, enrich, transform, resolveClientByName, onDone, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const data = res.data as any[];
        const hdrs = (res.meta.fields || []).map(h => h.trim());
        setHeaders(hdrs);
        setRows(data);
        const norm = (x: string) => x.toLowerCase().replace(/[\s_\-./]+/g, "");
        const m: Record<string, string> = {};
        fields.forEach(f => {
          const fk = norm(f.key);
          const fl = norm(f.label);
          const h = hdrs.find(h => {
            const nh = norm(h);
            return nh === fk || nh === fl || nh.includes(fk) || fk.includes(nh);
          });
          if (h) m[f.key] = h;
        });
        setMapping(m);
      }
    });
  }

  async function commit() {
    const missing = fields.filter(f => f.required && !mapping[f.key]);
    if (missing.length) { toast.error(`Map required: ${missing.map(m=>m.label).join(", ")}`); return; }
    setBusy(true);

    // Optional: build a name → id index for client lookup
    let nameToId = new Map<string, string>();
    if (resolveClientByName) {
      const { data } = await supabase.from("clients").select("id, company_name");
      (data ?? []).forEach((c: any) => nameToId.set(String(c.company_name).trim().toLowerCase(), c.id));
    }

    const { data: { user } } = await supabase.auth.getUser();

    const errors: string[] = [];
    const payload: any[] = [];
    rows.forEach((r, idx) => {
      const obj: Record<string, any> = {};
      fields.forEach(f => {
        let v = mapping[f.key] ? r[mapping[f.key]] : undefined;
        if (typeof v === "string") v = v.trim();
        if (v === undefined || v === "") return;

        if (f.type === "date" || /(_date|_at|deadline|due)$/i.test(f.key)) {
          const iso = normalizeDate(v);
          if (!iso) { errors.push(`Row ${idx + 2}: bad date "${v}" for ${f.label}`); return; }
          v = iso;
        } else if (f.type === "number") {
          const n = Number(String(v).replace(/[, ]/g, ""));
          if (isNaN(n)) { errors.push(`Row ${idx + 2}: bad number "${v}" for ${f.label}`); return; }
          v = n;
        }
        obj[f.key] = v;
      });

      // Client name → id resolution
      if (resolveClientByName && obj.client_id && !/^[0-9a-f]{8}-/i.test(String(obj.client_id))) {
        const id = nameToId.get(String(obj.client_id).trim().toLowerCase());
        if (!id) { errors.push(`Row ${idx + 2}: client "${obj.client_id}" not found`); return; }
        obj.client_id = id;
      }

      const enriched = enrich ? { ...obj, ...enrich({ ...obj, _uid: user?.id }) } : obj;
      const final = transform ? transform(enriched) : enriched;
      if (Object.keys(final).length > 0) payload.push(final);
    });

    if (errors.length && payload.length === 0) {
      setBusy(false);
      toast.error(`Import aborted. ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ""}`);
      return;
    }

    const BATCH = 200;
    let inserted = 0;
    const dbErrors: string[] = [];
    for (let i = 0; i < payload.length; i += BATCH) {
      const slice = payload.slice(i, i + BATCH);
      const { error } = await supabase.from(table as any).insert(slice as any);
      if (error) dbErrors.push(error.message);
      else inserted += slice.length;
    }
    setBusy(false);
    const skipped = errors.length;
    if (dbErrors.length) toast.error(`Imported ${inserted}/${payload.length}. ${dbErrors[0]}`);
    else if (skipped) toast.success(`Imported ${inserted} rows · skipped ${skipped} with format issues`);
    else toast.success(`Imported ${inserted} rows`);
    if (inserted > 0) { setOpen(false); setRows([]); setHeaders([]); setMapping({}); onDone?.(); }
  }

  return (
    <>
      <button type="button" onClick={()=>setOpen(true)} className="h-9 px-3 rounded-md border bg-background text-sm inline-flex items-center gap-2 hover:bg-muted">
        {trigger || <><Upload className="h-4 w-4" /> Import CSV</>}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={()=>setOpen(false)}>
          <div onClick={e=>e.stopPropagation()} className="bg-card w-full max-w-2xl rounded-lg p-6 space-y-4 max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Bulk import — {table}</h2>
              <button onClick={()=>setOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            {rows.length === 0 ? (
              <>
                <p className="text-sm text-muted-foreground">Upload a CSV file. The first row should contain column headers. Dates can be ISO, DD/MM/YYYY, or Excel serial numbers. PDF/Excel: export to CSV first.</p>
                <label className="block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
                  <div className="mt-2 text-sm">Click to select a CSV file</div>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
                </label>
                <div className="text-xs text-muted-foreground">
                  <div className="font-medium mb-1">Expected columns:</div>
                  <div className="flex flex-wrap gap-1">
                    {fields.map(f => <span key={f.key} className="px-2 py-0.5 bg-muted rounded">{f.label}{f.required && " *"}</span>)}
                  </div>
                  {resolveClientByName && <div className="mt-2">Tip: for "Client ID" you can supply the company name — we'll match it automatically.</div>}
                </div>
              </>
            ) : (
              <>
                <div className="text-sm">{rows.length} rows detected. Map columns:</div>
                <div className="grid gap-2">
                  {fields.map(f => (
                    <div key={f.key} className="grid grid-cols-2 gap-2 items-center">
                      <div className="text-sm">{f.label} {f.required && <span className="text-destructive">*</span>}</div>
                      <select value={mapping[f.key] || ""} onChange={e=>setMapping({...mapping, [f.key]: e.target.value})} className="h-8 px-2 rounded-md border bg-background text-sm">
                        <option value="">— Skip —</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>{ setRows([]); setHeaders([]); setMapping({}); }} className="flex-1 h-9 rounded-md border text-sm">Change file</button>
                  <button disabled={busy} onClick={commit} className="flex-1 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium">{busy?"Importing…":`Import ${rows.length} rows`}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
