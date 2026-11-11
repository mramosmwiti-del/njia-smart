import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { STATUS_COLORS } from "@/lib/format";
import { useTaskWorkspace } from "./use-task-workspace";
import { ProgressBar } from "./progress-bar";
import { OverviewPanel } from "./overview-panel";
import { SubtasksPanel } from "./subtasks-panel";
import { UpdatesPanel } from "./updates-panel";
import { OutputsPanel } from "./outputs-panel";
import { TimelinePanel } from "./timeline-panel";
import { TASK_STATUSES, displayProgress, type WorkspaceTab } from "./types";

// The workspace for one task: progress, subtasks, notes and guidance, outputs and a timeline.
export function TaskWorkspace({ id, onClose }: { id: string; onClose: () => void }) {
  const ctx = useTaskWorkspace(id);
  const { task, loading, missingSetup, subtasks, outputs, updates, isLead, hasSubtasks, subtasksDone, nameOf, setStatus, setProgress } = ctx;
  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const [draftPct, setDraftPct] = useState(0);

  const pct = displayProgress(task);
  useEffect(() => { setDraftPct(pct); }, [pct]);

  const notesCount = updates.filter(u => u.kind !== "system").length;
  const tabs: { key: WorkspaceTab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "subtasks", label: "Subtasks", count: subtasks.length },
    { key: "notes", label: "Notes & guidance", count: notesCount },
    { key: "outputs", label: "Outputs", count: outputs.length },
    { key: "timeline", label: "Timeline" },
  ];

  const canSetStatus = isLead;
  const canSetProgress = isLead && !hasSubtasks && task?.status !== "done";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-card w-full max-w-3xl h-full flex flex-col shadow-xl animate-fade-in">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold break-words">{task?.title || (loading ? "Loading…" : "Task not found")}</h2>
              {task && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {task.clients?.company_name ? `${task.clients.company_name} · ` : ""}
                  {nameOf(task.assigned_to)}{task.created_by && task.created_by !== task.assigned_to ? ` · given by ${nameOf(task.created_by)}` : ""}
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-1 hover:text-primary" title="Close"><X className="h-5 w-5" /></button>
          </div>

          {task && (
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
              <div className="space-y-1">
                <ProgressBar value={draftPct} />
                {hasSubtasks && <div className="text-[11px] text-muted-foreground">Calculated from subtasks ({subtasksDone} of {subtasks.length} done)</div>}
                {canSetProgress && (
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={draftPct}
                    onChange={e => setDraftPct(Number(e.target.value))}
                    onMouseUp={() => draftPct !== pct && setProgress(draftPct)}
                    onTouchEnd={() => draftPct !== pct && setProgress(draftPct)}
                    onKeyUp={() => draftPct !== pct && setProgress(draftPct)}
                    className="w-full"
                    aria-label="Set progress"
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                {task.needs_guidance && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Awaiting guidance</span>}
                <select
                  value={task.status}
                  disabled={!canSetStatus}
                  onChange={e => setStatus(e.target.value)}
                  className={`h-8 px-2 rounded text-xs border bg-background capitalize ${STATUS_COLORS[task.status] ?? ""}`}
                >
                  {TASK_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="flex gap-1 overflow-x-auto -mb-3">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 ${tab === t.key ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {t.label}{t.count ? <span className="ml-1.5 text-[11px] rounded-full bg-muted px-1.5 py-0.5">{t.count}</span> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {missingSetup && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm">
              The Task Workspace database update has not been run yet, so subtasks and outputs are unavailable. Ask your admin to run the latest database update.
            </div>
          )}
          {!task && !loading && <p className="text-sm text-muted-foreground">This task was not found, or you do not have access to it.</p>}
          {task && tab === "overview" && <OverviewPanel ctx={ctx} />}
          {task && tab === "subtasks" && <SubtasksPanel ctx={ctx} />}
          {task && tab === "notes" && <UpdatesPanel ctx={ctx} />}
          {task && tab === "outputs" && <OutputsPanel ctx={ctx} />}
          {task && tab === "timeline" && <TimelinePanel ctx={ctx} />}
        </div>
      </div>
    </div>
  );
}
