// Simple progress bar used in the task list and the workspace.
export function ProgressBar({ value, size = "md", showLabel = true }: { value: number; size?: "sm" | "md"; showLabel?: boolean }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const color = v >= 100 ? "bg-emerald-500" : v >= 50 ? "bg-primary" : "bg-amber-500";
  return (
    <div className="flex items-center gap-2 w-full">
      <div
        className={`flex-1 rounded-full bg-muted overflow-hidden ${size === "sm" ? "h-1.5" : "h-2.5"}`}
        role="progressbar"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${v}%` }} />
      </div>
      {showLabel && <span className="text-xs tabular-nums text-muted-foreground w-9 text-right">{v}%</span>}
    </div>
  );
}
