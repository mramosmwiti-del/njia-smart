import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth, ROLE_LABELS, type AppRole } from "@/lib/auth";
import {
  getStaffMember,
  adminUpdateStaff,
  adminResetPassword,
  adminSetPaused,
  adminDeleteStaff,
} from "@/lib/admin.functions";
import { ArrowLeft, Upload, Lock, ShieldAlert, Pause, Play, Trash2, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authed/team/$id")({ component: MemberProfile });

function MemberProfile() {
  const { id } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const fetchMember = useServerFn(getStaffMember);
  const adminUpdate = useServerFn(adminUpdateStaff);
  const adminReset = useServerFn(adminResetPassword);
  const adminPause = useServerFn(adminSetPaused);
  const adminDelete = useServerFn(adminDeleteStaff);

  const [data, setData] = useState<{ profile: any; roles: string[]; email: string | null; is_paused: boolean } | null>(null);
  const [form, setForm] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState({ p1: "", p2: "" });
  const [adminPw, setAdminPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isSelf = user?.id === id;
  const canEdit = isSelf || isAdmin;

  async function load() {
    const res = await fetchMember({ data: { user_id: id } });
    setData(res as any);
    setForm(res.profile || { id });
    setEmail(res.email || "");
  }
  useEffect(() => { load(); }, [id]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    try {
      if (isSelf) {
        const { error } = await supabase.from("profiles").update({
          full_name: form.full_name,
          job_title: form.job_title,
          department: form.department,
          phone: form.phone,
        }).eq("id", id);
        if (error) throw error;
      } else {
        await adminUpdate({ data: {
          user_id: id,
          full_name: form.full_name,
          job_title: form.job_title,
          department: form.department,
          phone: form.phone,
          email: email && email !== data?.email ? email : undefined,
        }});
      }
      toast.success("Profile updated");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally { setBusy(false); }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!isSelf) return;
    if (pw.p1.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw.p1 !== pw.p2) return toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw.p1 });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Password changed"); setPw({ p1: "", p2: "" }); }
  }

  async function adminResetPw(e: React.FormEvent) {
    e.preventDefault();
    if (adminPw.length < 8) return toast.error("Password must be at least 8 characters");
    setBusy(true);
    try {
      await adminReset({ data: { user_id: id, password: adminPw } });
      toast.success("Password reset. Share it securely with the staff member.");
      setAdminPw("");
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(false); }
  }

  async function togglePause() {
    if (!data) return;
    const next = !data.is_paused;
    if (!confirm(next ? "Pause this account? The user won't be able to sign in." : "Resume this account?")) return;
    setBusy(true);
    try {
      await adminPause({ data: { user_id: id, paused: next } });
      toast.success(next ? "Account paused" : "Account resumed");
      load();
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(false); }
  }

  async function deleteAccount() {
    if (!confirm("Delete this staff account permanently? This cannot be undone.")) return;
    setBusy(true);
    try {
      await adminDelete({ data: { user_id: id } });
      toast.success("Staff account deleted");
      navigate({ to: "/team" });
    } catch (err: any) { toast.error(err.message); setBusy(false); }
  }

  async function uploadAvatar(file: File) {
    if (!isSelf) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${id}/avatar-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (up.error) { setUploading(false); return toast.error(up.error.message); }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", id);
    setUploading(false);
    if (error) toast.error(error.message); else { toast.success("Photo updated"); load(); }
  }

  if (!data || !form) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const initials = (form.full_name || data.email || "?").split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-4 max-w-2xl">
      <Link to="/team" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Team
      </Link>

      <div className="bg-card border rounded-lg p-5 flex items-center gap-4">
        <div className="relative">
          {form.avatar_url ? (
            <img src={form.avatar_url} alt={form.full_name || "avatar"} className="h-20 w-20 rounded-full object-cover border" />
          ) : (
            <div className="h-20 w-20 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-semibold">{initials}</div>
          )}
          {isSelf && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow"
              title="Change photo"
            ><Upload className="h-3.5 w-3.5" /></button>
          )}
          <input
            ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.currentTarget.value = ""; }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold truncate">{form.full_name || "Unnamed"}</h1>
            {data.is_paused && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">Paused</span>}
          </div>
          <div className="text-sm text-muted-foreground truncate">{data.email}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {data.roles.length === 0 ? <span className="text-xs text-muted-foreground">No role assigned</span> :
              data.roles.map(r => <span key={r} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{ROLE_LABELS[r as AppRole] || r}</span>)}
          </div>
          {uploading && <div className="text-xs text-muted-foreground mt-1">Uploading…</div>}
        </div>
      </div>

      <form onSubmit={saveProfile} className="bg-card border rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Details</h2>
          {!canEdit && <span className="text-xs text-muted-foreground">View only</span>}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Full name">
            <input disabled={!canEdit} value={form.full_name || ""} onChange={e => setForm({ ...form, full_name: e.target.value })} className={input(canEdit)} />
          </Field>
          <Field label="Job title">
            <input disabled={!canEdit} value={form.job_title || ""} onChange={e => setForm({ ...form, job_title: e.target.value })} className={input(canEdit)} />
          </Field>
          <Field label="Department">
            <input disabled={!canEdit} value={form.department || ""} onChange={e => setForm({ ...form, department: e.target.value })} className={input(canEdit)} />
          </Field>
          <Field label="Office email">
            <input
              type="email"
              disabled={!isAdmin || isSelf}
              value={isAdmin && !isSelf ? email : (data.email || "")}
              onChange={e => setEmail(e.target.value)}
              className={input(isAdmin && !isSelf)}
            />
          </Field>
          <Field label="Phone number">
            <input disabled={!canEdit} value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} className={input(canEdit)} />
          </Field>
          <Field label="Role">
            <input disabled value={data.roles.map(r => ROLE_LABELS[r as AppRole] || r).join(", ") || "—"} className={input(false)} />
          </Field>
        </div>
        {canEdit && (
          <button disabled={busy} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium">
            {busy ? "Saving…" : "Save changes"}
          </button>
        )}
        {!canEdit && (
          <p className="text-xs text-muted-foreground">You can only edit your own profile. Ask a Director or Admin for account changes.</p>
        )}
      </form>

      {isSelf && (
        <form onSubmit={changePassword} className="bg-card border rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2"><Lock className="h-4 w-4" /><h2 className="font-semibold">Change password</h2></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="New password">
              <input type="password" value={pw.p1} onChange={e => setPw({ ...pw, p1: e.target.value })} className={input(true)} minLength={8} />
            </Field>
            <Field label="Confirm password">
              <input type="password" value={pw.p2} onChange={e => setPw({ ...pw, p2: e.target.value })} className={input(true)} minLength={8} />
            </Field>
          </div>
          <button disabled={busy || !pw.p1} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium">
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      )}

      {isAdmin && !isSelf && (
        <div className="bg-card border rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-primary" /><h2 className="font-semibold">Admin controls</h2></div>

          <form onSubmit={adminResetPw} className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium"><KeyRound className="h-4 w-4" /> Reset password</div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="New password (min 8 chars)"
                minLength={8}
                value={adminPw}
                onChange={e => setAdminPw(e.target.value)}
                className="flex-1 h-9 px-3 rounded-md border bg-background text-sm"
              />
              <button disabled={busy || adminPw.length < 8} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium">
                Reset
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Share the new password securely with the staff member.</p>
          </form>

          <div className="border-t pt-4 space-y-2">
            <div className="text-sm font-medium">Account status</div>
            <button
              type="button"
              onClick={togglePause}
              disabled={busy}
              className="h-9 px-4 rounded-md border text-sm font-medium inline-flex items-center gap-2 hover:bg-accent"
            >
              {data.is_paused ? <><Play className="h-4 w-4" /> Resume account</> : <><Pause className="h-4 w-4" /> Pause account</>}
            </button>
            <p className="text-xs text-muted-foreground">
              {data.is_paused ? "This user is currently blocked from signing in." : "Paused users cannot sign in until resumed."}
            </p>
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="text-sm font-medium text-destructive">Danger zone</div>
            <button
              type="button"
              onClick={deleteAccount}
              disabled={busy}
              className="h-9 px-4 rounded-md bg-destructive text-destructive-foreground text-sm font-medium inline-flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" /> Delete staff account
            </button>
            <p className="text-xs text-muted-foreground">This permanently removes the user, their sign-in access, and profile.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function input(editable: boolean) {
  return `w-full h-9 px-3 rounded-md border text-sm ${editable ? "bg-background" : "bg-muted text-muted-foreground"}`;
}
