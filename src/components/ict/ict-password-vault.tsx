import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, LockKeyhole, Plus, Search, Pencil, Trash2, Copy, ShieldCheck, KeyRound, LogOut, RefreshCw, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";

type VaultConfig = { id: boolean; salt: string; verification_iv: string; verification_ciphertext: string };
type VaultRow = { id: string; encrypted_data: string; iv: string; created_at: string; updated_at: string; created_by: string | null; updated_by: string | null };
type FieldType = "text" | "password" | "url";
type FieldDef = { key: string; label: string; type: FieldType; required?: boolean; placeholder?: string };
type Entry = { id?: string; name: string; category: string; fields: Record<string, string>; notes: string; updated_at?: string; created_at?: string };

/**
 * What a credential needs varies by category — Wi-Fi needs an SSID, email
 * needs IMAP/SMTP settings, a licence needs a key and seat count, and so on.
 * Each category below defines its own set of fields; the form, the entry
 * cards and search/copy/reveal all read from this instead of one fixed
 * username/password/URL shape.
 */
const CATEGORY_FIELDS: Record<string, FieldDef[]> = {
  "Email": [
    { key: "email_address", label: "Email address", type: "text", required: true, placeholder: "name@company.co.ke" },
    { key: "password", label: "Password", type: "password", required: true },
    { key: "recovery", label: "Recovery email / phone", type: "text" },
    { key: "server_settings", label: "IMAP / SMTP server settings", type: "text", placeholder: "imap.example.com:993, smtp.example.com:465" },
  ],
  "Network / Wi-Fi": [
    { key: "ssid", label: "SSID (network name)", type: "text", required: true },
    { key: "password", label: "Wi-Fi password", type: "password", required: true },
    { key: "admin_url", label: "Router admin URL / IP", type: "url" },
  ],
  "Router / Firewall": [
    { key: "admin_url", label: "Admin URL / IP address", type: "url", required: true },
    { key: "username", label: "Admin username", type: "text" },
    { key: "password", label: "Admin password", type: "password", required: true },
  ],
  "Software / Licences": [
    { key: "license_key", label: "Licence key", type: "password", required: true },
    { key: "username", label: "Account / username", type: "text" },
    { key: "password", label: "Account password", type: "password" },
    { key: "seats", label: "Seats / users licensed", type: "text" },
  ],
  "Website / Domain": [
    { key: "registrar_url", label: "Registrar / portal URL", type: "url" },
    { key: "username", label: "Username", type: "text" },
    { key: "password", label: "Password", type: "password", required: true },
    { key: "renewal_date", label: "Renewal date", type: "text", placeholder: "e.g. 2027-03-15" },
  ],
  "Cloud / Hosting": [
    { key: "portal_url", label: "Console / portal URL", type: "url" },
    { key: "username", label: "Username", type: "text" },
    { key: "password", label: "Password", type: "password", required: true },
  ],
  "Printer / Copier": [
    { key: "ip_address", label: "IP address / location", type: "text" },
    { key: "username", label: "Admin username", type: "text" },
    { key: "password", label: "Admin password", type: "password" },
  ],
  "Computer / Device": [
    { key: "device_location", label: "Device / location", type: "text" },
    { key: "username", label: "Login username", type: "text" },
    { key: "password", label: "Login password", type: "password", required: true },
  ],
  "Business System": [
    { key: "system_url", label: "System URL", type: "url" },
    { key: "username", label: "Username", type: "text" },
    { key: "password", label: "Password", type: "password", required: true },
  ],
  "Other": [
    { key: "username", label: "Username / account", type: "text" },
    { key: "password", label: "Password / secret", type: "password", required: true },
    { key: "url", label: "URL / location", type: "url" },
  ],
};
const CATEGORIES = Object.keys(CATEGORY_FIELDS);
const fieldsFor = (category: string) => CATEGORY_FIELDS[category] ?? CATEGORY_FIELDS.Other;
const emptyEntry = (category: string = CATEGORIES[0]): Entry => ({ name: "", category, fields: {}, notes: "" });

/** Carry over values for any field key the new category's schema also has; drop the rest. */
function remapFields(fields: Record<string, string>, nextCategory: string) {
  const nextKeys = new Set(fieldsFor(nextCategory).map((f) => f.key));
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) if (nextKeys.has(k)) next[k] = v;
  return next;
}

/**
 * Entries saved before per-category fields existed stored a fixed
 * {username, password, url} shape. Fold that into the new `fields` object
 * (matched against the category's current schema) so old credentials keep
 * decrypting and displaying correctly.
 */
function normalizeDecoded(raw: any, category: string): Record<string, string> {
  if (raw && typeof raw === "object" && raw.fields && typeof raw.fields === "object") return raw.fields;
  const schema = fieldsFor(category);
  const fields: Record<string, string> = {};
  if (raw?.username && schema.some((f) => f.key === "username")) fields.username = raw.username;
  if (raw?.password) fields[schema.find((f) => f.type === "password")?.key ?? "password"] = raw.password;
  if (raw?.url) {
    const urlKey = schema.find((f) => f.type === "url")?.key;
    if (urlKey) fields[urlKey] = raw.url;
  }
  return fields;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}
function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}
async function deriveKey(passphrase: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function encryptText(key: CryptoKey, value: string) {
  const iv = randomBytes(12);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(value));
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(encrypted)) };
}
async function decryptText(key: CryptoKey, iv: string, ciphertext: string) {
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, key, fromBase64(ciphertext));
  return decoder.decode(clear);
}

/**
 * Office credentials are encrypted in the browser using a shared vault passphrase.
 * The passphrase/key are never stored in localStorage, sessionStorage or the database.
 */
export function IctPasswordVault() {
  const [config, setConfig] = useState<VaultConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [rows, setRows] = useState<VaultRow[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [editing, setEditing] = useState<Entry | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Entry>(emptyEntry());
  const [saving, setSaving] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());
  const [visibleFormFields, setVisibleFormFields] = useState<Set<string>>(new Set());
  // Entry cards start collapsed to a single line (name + category) so a long
  // vault doesn't force endless scrolling — expand one at a time, or all at once.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggleExpanded(id: string) {
    setExpanded((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    let timer: ReturnType<typeof setTimeout>;
    const lockAfterIdle = () => {
      setKey(null);
      setEntries([]);
      setRows([]);
      setVisibleFields(new Set());
      setEditing(null);
      setForm(emptyEntry());
      setFormOpen(false);
      toast.info("The password vault was locked after 10 minutes of inactivity.");
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(lockAfterIdle, 10 * 60 * 1000);
    };
    const activityEvents: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart"];
    activityEvents.forEach((event) => window.addEventListener(event, schedule, { passive: true }));
    schedule();
    return () => {
      clearTimeout(timer);
      activityEvents.forEach((event) => window.removeEventListener(event, schedule));
    };
  }, [key]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: auth }, { data, error }] = await Promise.all([
        supabase.auth.getUser(),
        (supabase.from("ict_password_vault_config" as any) as any).select("id,salt,verification_iv,verification_ciphertext").eq("id", true).maybeSingle(),
      ]);
      if (!active) return;
      if (error) toast.error(`Could not load vault configuration: ${error.message}`);
      setUserId(auth.user?.id ?? null);
      setConfig((data as VaultConfig | null) ?? null);
      setConfigLoading(false);
    })();
    return () => { active = false; };
  }, []);

  async function loadEntries(activeKey: CryptoKey): Promise<boolean> {
    setLoading(true);
    const { data, error } = await (supabase.from("ict_password_vault" as any) as any)
      .select("id,encrypted_data,iv,created_at,updated_at,created_by,updated_by")
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error(`Could not load vault entries: ${error.message}`);
      setLoading(false);
      return false;
    }
    const loadedRows = (data ?? []) as VaultRow[];
    try {
      const decoded = await Promise.all(loadedRows.map(async (row) => {
        const raw = JSON.parse(await decryptText(activeKey, row.iv, row.encrypted_data));
        const category = raw.category && CATEGORY_FIELDS[raw.category] ? raw.category : "Other";
        return {
          name: raw.name ?? "",
          category,
          fields: normalizeDecoded(raw, category),
          notes: raw.notes ?? "",
          id: row.id,
          created_at: row.created_at,
          updated_at: row.updated_at,
        } as Entry;
      }));
      setRows(loadedRows);
      setEntries(decoded);
      return true;
    } catch {
      setKey(null);
      setRows([]);
      setEntries([]);
      toast.error("The vault could not be decrypted. It may have been changed or the passphrase is incorrect. The vault has been locked.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function unlockOrInitialize(event: React.FormEvent) {
    event.preventDefault();
    if (!passphrase.trim()) { toast.error("Enter the vault passphrase."); return; }
    setLoading(true);
    try {
      if (!config) {
        if (passphrase.length < 12) { toast.error("Choose a strong vault passphrase with at least 12 characters."); setLoading(false); return; }
        if (passphrase !== confirmPassphrase) { toast.error("The passphrases do not match."); setLoading(false); return; }
        const salt = randomBytes(16);
        const derived = await deriveKey(passphrase, salt);
        const verification = await encryptText(derived, "NJIA-SMART-ICT-VAULT-VERIFIED-V1");
        const { data, error } = await (supabase.from("ict_password_vault_config" as any) as any).insert({
          id: true,
          salt: toBase64(salt),
          verification_iv: verification.iv,
          verification_ciphertext: verification.ciphertext,
          created_by: userId,
        }).select("id,salt,verification_iv,verification_ciphertext").single();
        if (error) {
          // If another authorised operator initialized the vault at the same time, reload the shared configuration.
          const { data: existing } = await (supabase.from("ict_password_vault_config" as any) as any).select("id,salt,verification_iv,verification_ciphertext").eq("id", true).maybeSingle();
          if (existing) {
            setConfig(existing as VaultConfig);
            toast.error("The vault was initialized by another operator. Enter the shared vault passphrase to unlock it.");
          } else toast.error(`Could not initialize vault: ${error.message}`);
          setLoading(false);
          return;
        }
        setConfig(data as VaultConfig);
        setKey(derived);
        setPassphrase("");
        setConfirmPassphrase("");
        const loaded = await loadEntries(derived);
        if (loaded) toast.success("Password vault initialized and unlocked.");
        return;
      }
      const derived = await deriveKey(passphrase, fromBase64(config.salt));
      const check = await decryptText(derived, config.verification_iv, config.verification_ciphertext);
      if (check !== "NJIA-SMART-ICT-VAULT-VERIFIED-V1") throw new Error("Incorrect passphrase");
      setKey(derived);
      setPassphrase("");
      setConfirmPassphrase("");
      const loaded = await loadEntries(derived);
      if (loaded) toast.success("Password vault unlocked.");
    } catch {
      toast.error("Unable to unlock the vault. Check the passphrase and try again.");
    } finally {
      setLoading(false);
    }
  }

  function lockVault() {
    setKey(null);
    setEntries([]);
    setRows([]);
    setVisibleFields(new Set());
    setEditing(null);
    setForm(emptyEntry());
    setFormOpen(false);
    setPassphrase("");
    setConfirmPassphrase("");
  }

  function openNewEntry() { setEditing(null); setForm(emptyEntry()); setVisibleFormFields(new Set()); setFormOpen(true); }
  function openEditEntry(entry: Entry) { setEditing(entry); setForm({ ...entry, fields: { ...entry.fields } }); setVisibleFormFields(new Set()); setFormOpen(true); }

  function setFormCategory(category: string) {
    setForm((f) => ({ ...f, category, fields: remapFields(f.fields, category) }));
    setVisibleFormFields(new Set());
  }
  function setFormField(key: string, value: string) {
    setForm((f) => ({ ...f, fields: { ...f.fields, [key]: value } }));
  }

  async function saveEntry(event: React.FormEvent) {
    event.preventDefault();
    const schema = fieldsFor(form.category);
    const missingRequired = schema.filter((f) => f.required && !(form.fields[f.key] ?? "").trim());
    if (!key || !form.name.trim() || missingRequired.length) {
      toast.error(`A system name and ${missingRequired[0]?.label.toLowerCase() ?? "all required fields"} are required.`);
      return;
    }
    setSaving(true);
    try {
      const cleanedFields: Record<string, string> = {};
      for (const f of schema) {
        const v = (form.fields[f.key] ?? "").trim();
        if (v) cleanedFields[f.key] = v;
      }
      const encrypted = await encryptText(key, JSON.stringify({
        name: form.name.trim(), category: form.category, fields: cleanedFields, notes: form.notes.trim(),
      }));
      const payload = { encrypted_data: encrypted.ciphertext, iv: encrypted.iv, updated_by: userId, updated_at: new Date().toISOString() };
      const query = supabase.from("ict_password_vault" as any) as any;
      const result = editing?.id
        ? await query.update(payload).eq("id", editing.id)
        : await query.insert({ ...payload, created_by: userId });
      if (result.error) throw result.error;
      toast.success(editing ? "Credential updated." : "Credential saved.");
      setEditing(null);
      setForm(emptyEntry());
      setFormOpen(false);
      await loadEntries(key);
    } catch (error: any) {
      toast.error(`Could not save credential: ${error?.message ?? "Unknown error"}`);
    } finally { setSaving(false); }
  }

  async function deleteEntry(entry: Entry) {
    if (!entry.id || !window.confirm(`Delete the saved credentials for “${entry.name}”? This cannot be undone.`)) return;
    const { error } = await (supabase.from("ict_password_vault" as any) as any).delete().eq("id", entry.id);
    if (error) { toast.error(`Could not delete credential: ${error.message}`); return; }
    toast.success("Credential deleted.");
    if (key) await loadEntries(key);
  }

  async function copyValue(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); toast.success(`${label} copied. Clear it from the clipboard when finished.`); }
    catch { toast.error("Clipboard access was blocked by the browser."); }
  }

  const filteredEntries = useMemo(() => entries.filter((entry) => {
    const matchesCategory = categoryFilter === "All categories" || entry.category === categoryFilter;
    const term = search.trim().toLowerCase();
    const haystack = [entry.name, entry.category, entry.notes, ...Object.values(entry.fields)];
    return matchesCategory && (!term || haystack.some((v) => (v ?? "").toLowerCase().includes(term)));
  }), [entries, categoryFilter, search]);

  if (configLoading) return <section className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">Loading password vault…</section>;

  return (
    <section className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><LockKeyhole className="h-5 w-5 text-primary" /></div>
          <div><h2 className="font-semibold">ICT Password Vault</h2><p className="text-xs text-muted-foreground">Encrypted office credentials, organised by system and category.</p></div>
        </div>
        {key && <button type="button" onClick={lockVault} className="h-8 px-3 rounded-md border text-xs inline-flex items-center gap-1.5"><LogOut className="h-3.5 w-3.5" /> Lock vault</button>}
      </div>

      {!key ? (
        <form onSubmit={unlockOrInitialize} className="p-4 sm:p-6 max-w-xl space-y-4">
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4" /> Encrypted vault</div>
            <p className="mt-1 text-muted-foreground">Credentials are encrypted in your browser before being saved. Use one strong shared vault passphrase with authorised vault users. The passphrase is never saved by this app.</p>
          </div>
          {!config && <p className="text-sm text-muted-foreground">This vault has not been initialized. The first authorised operator must create the shared passphrase. Store it safely: it cannot be recovered if lost.</p>}
          <label className="block text-sm font-medium">{config ? "Vault passphrase" : "Create shared vault passphrase"}
            <div className="mt-1 flex gap-2"><input autoComplete="current-password" type={showPassphrase ? "text" : "password"} value={passphrase} onChange={(e) => setPassphrase(e.target.value)} required minLength={config ? 1 : 12} className="h-10 w-full rounded-md border bg-background px-3 text-sm" placeholder="Enter vault passphrase" /><button type="button" onClick={() => setShowPassphrase((v) => !v)} className="h-10 w-10 shrink-0 rounded-md border inline-flex items-center justify-center" aria-label={showPassphrase ? "Hide passphrase" : "Show passphrase"}>{showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
          </label>
          {!config && <label className="block text-sm font-medium">Confirm passphrase<input autoComplete="new-password" type={showPassphrase ? "text" : "password"} value={confirmPassphrase} onChange={(e) => setConfirmPassphrase(e.target.value)} required minLength={12} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" /></label>}
          <button disabled={loading} className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50">{loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}{loading ? "Unlocking…" : config ? "Unlock vault" : "Initialize vault"}</button>
        </form>
      ) : (
        <div className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search systems, usernames, URLs or notes…" className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" /></div>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm"><option>All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            <button type="button" onClick={openNewEntry} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center justify-center gap-1.5"><Plus className="h-4 w-4" /> Add credential</button>
          </div>
          {filteredEntries.length > 0 && (
            <div className="flex justify-end">
              <button type="button" onClick={() => setExpanded(expanded.size ? new Set() : new Set(filteredEntries.map((e) => e.id!)))} className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                {expanded.size ? <><ChevronsDownUp className="h-3.5 w-3.5" /> Collapse all</> : <><ChevronsUpDown className="h-3.5 w-3.5" /> Expand all</>}
              </button>
            </div>
          )}
          {formOpen ? (
            <form onSubmit={saveEntry} className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{editing ? "Edit credential" : "New credential"}</h3><button type="button" onClick={() => { setEditing(null); setForm(emptyEntry()); setFormOpen(false); }} className="text-sm text-muted-foreground">Cancel</button></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">System / service name *<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Office Wi-Fi, domain registrar" className="mt-1 h-9 w-full rounded-md border bg-background px-3 font-normal" /></label>
                <label className="text-sm font-medium">Category<select value={form.category} onChange={(e) => setFormCategory(e.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-3 font-normal">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
                {fieldsFor(form.category).map((f) => {
                  const value = form.fields[f.key] ?? "";
                  if (f.type === "password") {
                    const shown = visibleFormFields.has(f.key);
                    return (
                      <label key={f.key} className="text-sm font-medium">{f.label}{f.required ? " *" : ""}
                        <div className="mt-1 flex gap-2">
                          <input required={f.required} autoComplete="new-password" type={shown ? "text" : "password"} value={value} onChange={(e) => setFormField(f.key, e.target.value)} placeholder={f.placeholder} className="h-9 w-full min-w-0 rounded-md border bg-background px-3 font-normal" />
                          <button type="button" onClick={() => setVisibleFormFields((prev) => { const next = new Set(prev); shown ? next.delete(f.key) : next.add(f.key); return next; })} className="h-9 w-9 shrink-0 rounded-md border inline-flex items-center justify-center" aria-label={shown ? `Hide ${f.label}` : `Show ${f.label}`}>{shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                        </div>
                      </label>
                    );
                  }
                  return (
                    <label key={f.key} className="text-sm font-medium">{f.label}{f.required ? " *" : ""}
                      <input required={f.required} autoComplete="off" type={f.type === "url" ? "url" : "text"} value={value} onChange={(e) => setFormField(f.key, e.target.value)} placeholder={f.placeholder} className="mt-1 h-9 w-full rounded-md border bg-background px-3 font-normal" />
                    </label>
                  );
                })}
                <label className="text-sm font-medium sm:col-span-2">Notes / recovery instructions<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Non-secret context, owner, renewal date, recovery instructions…" className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-normal" /></label>
              </div>
              <button disabled={saving} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50">{saving ? "Saving…" : editing ? "Save changes" : "Save credential"}</button>
            </form>
          ) : null}

          {loading ? <div className="py-8 text-center text-sm text-muted-foreground">Decrypting vault entries…</div> : filteredEntries.length === 0 ? (
            <div className="py-10 text-center"><KeyRound className="h-8 w-8 mx-auto text-muted-foreground/50" /><p className="mt-2 text-sm font-medium">{entries.length ? "No matching credentials" : "No credentials saved yet"}</p><p className="mt-1 text-xs text-muted-foreground">Add each office system as a separate entry and assign the right category.</p></div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredEntries.map((entry) => {
                const schema = fieldsFor(entry.category);
                const isOpen = expanded.has(entry.id!);
                return <article key={entry.id} className="rounded-lg border p-4 min-w-0 space-y-3">
                  <button type="button" onClick={() => toggleExpanded(entry.id!)} className="w-full flex items-start gap-2 text-left">
                    {isOpen ? <ChevronDown className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />}
                    <div className="min-w-0 flex-1"><span className="inline-flex rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px]">{entry.category}</span><h3 className="mt-1 font-semibold break-words">{entry.name}</h3></div>
                  </button>
                  {isOpen && <div className="space-y-3">
                  <div className="flex justify-end gap-1 -mt-2"><button type="button" title="Edit credential" onClick={() => openEditEntry(entry)} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button><button type="button" title="Delete credential" onClick={() => deleteEntry(entry)} className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button></div>
                  {schema.map((f) => {
                    const value = entry.fields[f.key];
                    if (!value) return null;
                    const fieldId = `${entry.id}:${f.key}`;
                    if (f.type === "password") {
                      const shown = visibleFields.has(fieldId);
                      return (
                        <div key={f.key} className="text-sm"><div className="text-xs text-muted-foreground">{f.label}</div><div className="flex items-center gap-2"><code className="min-w-0 flex-1 break-all font-mono">{shown ? value : "••••••••••••"}</code><button type="button" title={shown ? `Hide ${f.label}` : `Reveal ${f.label}`} onClick={() => setVisibleFields((prev) => { const next = new Set(prev); shown ? next.delete(fieldId) : next.add(fieldId); return next; })} className="p-1 text-muted-foreground hover:text-primary">{shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button><button type="button" title={`Copy ${f.label}`} onClick={() => void copyValue(value, f.label)} className="p-1 text-muted-foreground hover:text-primary"><Copy className="h-3.5 w-3.5" /></button></div></div>
                      );
                    }
                    return (
                      <div key={f.key} className="text-sm min-w-0"><div className="text-xs text-muted-foreground">{f.label}</div><div className="flex items-center gap-2"><span className="min-w-0 flex-1 break-all">{value}</span><button type="button" title={`Copy ${f.label}`} onClick={() => void copyValue(value, f.label)} className="p-1 text-muted-foreground hover:text-primary"><Copy className="h-3.5 w-3.5" /></button></div></div>
                    );
                  })}
                  {entry.notes && <div className="text-sm"><div className="text-xs text-muted-foreground">Notes</div><p className="whitespace-pre-wrap break-words">{entry.notes}</p></div>}
                  <div className="pt-1 text-[11px] text-muted-foreground">Updated {entry.updated_at ? new Date(entry.updated_at).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</div>
                  </div>}
                </article>;
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Security reminder: use unique passwords, enable MFA where available, and do not store recovery codes or highly sensitive personal data unless your organisation has approved this vault for that purpose. Lock the vault when finished.</p>
        </div>
      )}
    </section>
  );
}
