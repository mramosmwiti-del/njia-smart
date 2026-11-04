

export function StatCard({ icon: Icon, label, value, onClick }: { icon: any; label: string; value: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-left bg-card rounded-lg border p-4 h-full w-full card-hover animate-fade-in-up hover:border-primary/60">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </button>
  );
}

