import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const isoInDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Asked whenever a task is set to "Waiting on client": what are we waiting for,
 * and when should the client be chased. Keeps the status meaningful and gives
 * management something to follow up on.
 */
export function WaitingOnClientDialog({
  taskTitle, onConfirm, onCancel,
}: {
  /** null = closed */
  taskTitle: string | null;
  onConfirm: (details: { reason: string; followUpOn: string }) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [followUpOn, setFollowUpOn] = useState(isoInDays(3));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (taskTitle !== null) { setReason(""); setFollowUpOn(isoInDays(3)); setBusy(false); }
  }, [taskTitle]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    setBusy(true);
    await onConfirm({ reason: reason.trim(), followUpOn });
    setBusy(false);
  }

  return (
    <Dialog open={taskTitle !== null} onOpenChange={o => { if (!o && !busy) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Waiting on client</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {taskTitle && <p className="text-xs text-muted-foreground truncate">{taskTitle}</p>}
          <div>
            <Label className="text-xs">What are we waiting for? *</Label>
            <Input autoFocus required value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Bank statements for June" />
          </div>
          <div>
            <Label className="text-xs">Chase the client on</Label>
            <Input type="date" value={followUpOn} min={isoInDays(0)} onChange={e => setFollowUpOn(e.target.value)} />
          </div>
          <p className="text-[11px] text-muted-foreground">While waiting, the task isn&apos;t counted as overdue against the assignee. It goes back to normal when you change the status.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || !reason.trim()}>{busy ? "Saving…" : "Mark waiting on client"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
