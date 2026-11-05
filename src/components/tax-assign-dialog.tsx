import { useEffect, useMemo, useState } from "react";
import { Check, Search, UserX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { notifyUser } from "@/lib/notify";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { assignTaxReturn } from "@/components/tax-assignee-select";

type Staff = { id: string; full_name: string | null };

/**
 * One place to put people on a specific tax obligation:
 *  - Main person: the owner of the filing (tax_returns.assigned_to).
 *  - Also working on it: any number of extra staff (tax_return_assignees).
 * Every change saves immediately, tells you if the database refused it, and
 * notifies the person added. Any staff member can be picked.
 */
export function TaxAssignDialog({
  open, onOpenChange, returnId, title, staff, primaryId, collaboratorIds, label, onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  returnId: string;
  title: string;                 // e.g. "VAT — ABBA-NISSI AGENCY LTD"
  staff: Staff[];
  primaryId: string | null | undefined;
  collaboratorIds: string[];
  label?: string;                // notification text
  onChanged: () => void | Promise<void>;
}) {
  const { user } = useAuth();
  const [primary, setPrimary] = useState<string | null>(primaryId ?? null);
  const [collabs, setCollabs] = useState<string[]>(collaboratorIds);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");

  // Re-sync when the dialog opens or a different obligation is shown.
  useEffect(() => {
    if (open) { setPrimary(primaryId ?? null); setCollabs(collaboratorIds); setQ(""); }
  }, [open, returnId]);

  const people = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...staff]
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""))
      .filter(s => !needle || (s.full_name ?? "").toLowerCase().includes(needle));
  }, [staff, q]);

  async function setMain(id: string | null) {
    if (id === primary) return;
    setBusy(`main:${id ?? "none"}`);
    const ok = await assignTaxReturn(returnId, id, user?.id, label);
    setBusy(null);
    if (!ok) return;            // assignTaxReturn already explained why
    setPrimary(id);
    // The main person doesn't also need to be listed as an extra person.
    if (id && collabs.includes(id)) {
      await supabase.from("tax_return_assignees" as any).delete().eq("tax_return_id", returnId).eq("user_id", id);
      setCollabs(c => c.filter(x => x !== id));
    }
    await onChanged();
  }

  async function toggleCollab(id: string) {
    if (id === primary) return;
    setBusy(`collab:${id}`);
    const on = collabs.includes(id);
    const { error } = on
      ? await supabase.from("tax_return_assignees" as any).delete().eq("tax_return_id", returnId).eq("user_id", id)
      : await supabase.from("tax_return_assignees" as any).insert({ tax_return_id: returnId, user_id: id, role: null, assigned_by: user?.id ?? null } as any);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    setCollabs(c => on ? c.filter(x => x !== id) : [...c, id]);
    if (!on && id !== user?.id) {
      await notifyUser({
        user_id: id, type: "tax", title: "Added to a tax filing",
        body: label ?? "You've been added to a tax filing.", link: "/tax",
      } as any);
    }
    await onChanged();
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign people</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search staff…" className="pl-8 h-9" />
        </div>

        <div className="max-h-[50vh] overflow-y-auto space-y-4 pr-1">
          <section>
            <div className="text-xs font-medium mb-1.5">Main person <span className="text-muted-foreground font-normal">(owns this filing)</span></div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button" disabled={busy !== null} onClick={() => setMain(null)}
                className={`h-7 px-2.5 rounded-full border text-xs inline-flex items-center gap-1 disabled:opacity-60 ${!primary ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-100" : "bg-background text-muted-foreground hover:border-primary/50"}`}
              ><UserX className="h-3 w-3" /> No one</button>
              {people.map(s => (
                <button
                  key={s.id} type="button" disabled={busy !== null} onClick={() => setMain(s.id)}
                  className={`h-7 px-2.5 rounded-full border text-xs inline-flex items-center gap-1 disabled:opacity-60 ${primary === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:border-primary/50"}`}
                >{primary === s.id && <Check className="h-3 w-3" />}{s.full_name ?? "Unnamed"}</button>
              ))}
            </div>
          </section>

          <section>
            <div className="text-xs font-medium mb-1.5">Also working on it <span className="text-muted-foreground font-normal">(tick as many as you like)</span></div>
            <div className="flex flex-wrap gap-1.5">
              {people.filter(s => s.id !== primary).map(s => {
                const on = collabs.includes(s.id);
                return (
                  <button
                    key={s.id} type="button" disabled={busy !== null} onClick={() => toggleCollab(s.id)}
                    className={`h-7 px-2.5 rounded-full border text-xs inline-flex items-center gap-1 disabled:opacity-60 ${on ? "bg-accent text-accent-foreground border-accent" : "bg-background hover:border-primary/50"}`}
                  >{on && <Check className="h-3 w-3" />}{s.full_name ?? "Unnamed"}</button>
                );
              })}
              {people.filter(s => s.id !== primary).length === 0 && <span className="text-xs text-muted-foreground">No staff match your search.</span>}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} disabled={busy !== null}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
