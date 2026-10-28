import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, UserX, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { assignTaxReturn } from "@/components/tax-assignee-select";

type Staff = { id: string; full_name: string | null };

/**
 * Inline "who handles this obligation" panel. Expands under a filing on the Tax
 * page, lists the team by name, and assigns the specific obligation in one
 * click - no trip to the client profile. Uses the same assignment logic (and
 * assignee notification) as the client's Tax tab, so both always agree.
 */
export function TaxAssignPanel({
  returnId, clientId, taxType, value, staff, collaboratorIds = [], title, label, onChanged, onClose,
}: {
  returnId: string;
  clientId: string;
  taxType: string;
  value: string | null | undefined;
  staff: Staff[];
  collaboratorIds?: string[];
  title: string;   // e.g. "PAYE — Acme Ltd"
  label?: string;  // notification text
  onChanged: () => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const nameOf = (id: string) => staff.find(s => s.id === id)?.full_name ?? "Unknown";
  const collabs = collaboratorIds.filter(id => id !== value);

  async function pick(id: string | null) {
    if ((id ?? null) === (value ?? null)) return;
    setBusyId(id ?? "__none__");
    const ok = await assignTaxReturn(returnId, id, user?.id, label);
    setBusyId(null);
    if (ok) onChanged();
  }

  return (
    <div className="rounded-md border bg-card p-3 space-y-2" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium">Assign <span className="text-primary">{title}</span> to</div>
        <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={busyId !== null}
          onClick={() => pick(null)}
          className={`h-7 px-2.5 rounded-full border text-xs inline-flex items-center gap-1 disabled:opacity-60 ${!value ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-100" : "bg-background text-muted-foreground hover:border-primary/50"}`}
        >
          <UserX className="h-3 w-3" /> Unassigned
        </button>
        {staff.map(s => {
          const active = s.id === value;
          return (
            <button
              key={s.id}
              type="button"
              disabled={busyId !== null}
              onClick={() => pick(s.id)}
              className={`h-7 px-2.5 rounded-full border text-xs inline-flex items-center gap-1 disabled:opacity-60 ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:border-primary/50"}`}
            >
              {active && <Check className="h-3 w-3" />}{s.full_name ?? "Unnamed"}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{collabs.length ? <>Also working on it: {collabs.map(nameOf).join(", ")}</> : "No other collaborators"}</span>
        <Link to="/clients/$id" params={{ id: clientId }} search={{ tab: "Tax", obligation: taxType }} className="text-primary hover:underline">Open on client profile →</Link>
      </div>
    </div>
  );
}
