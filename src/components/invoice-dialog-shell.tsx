import type { ReactNode } from "react";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// Shared chrome for the "generate invoice" dialogs (single task completion and
// batched tax filings): the dialog can't be dismissed while work is in flight,
// and the footer is always Cancel + a primary "Working…" aware action.
export function InvoiceDialogShell({ open, onOpenChange, busy, title, maxWidth = "max-w-md", submitLabel, onSubmit, children }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  busy: boolean;
  title: ReactNode;
  maxWidth?: string;
  submitLabel: string;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={o => !busy && onOpenChange(o)}>
      <DialogContent className={maxWidth}>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={onSubmit} disabled={busy}><Receipt className="h-3.5 w-3.5 mr-1" />{busy ? "Working…" : submitLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Labelled file input used for filing receipts and similar required attachments.
export function InvoiceFileField({ label, hint, small, onFile }: {
  label: string;
  hint?: string;
  small?: boolean;
  onFile: (file: File | null) => void;
}) {
  return (
    <div>
      <Label className={small ? "text-[11px]" : "text-xs"}>{label} *</Label>
      <Input type="file" onChange={e => onFile(e.target.files?.[0] ?? null)} />
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
