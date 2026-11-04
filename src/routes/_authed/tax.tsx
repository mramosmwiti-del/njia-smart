import { createFileRoute } from "@tanstack/react-router";
import { useTaxPage } from "@/components/tax/use-tax-page";
import { TABS } from "@/components/tax/tax-utils";
import { OverviewTab } from "@/components/tax/overview-tab";
import { ChecklistTab } from "@/components/tax/checklist-tab";
import { FilingRecordTab } from "@/components/tax/filing-record-tab";
import { AnnualTab } from "@/components/tax/annual-tab";
import { TaxDialogs } from "@/components/tax/tax-dialogs";

export const Route = createFileRoute("/_authed/tax")({
  validateSearch: (s: Record<string, unknown>) => ({
    filter: s.filter === "open" ? "open" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Tax | G.K Nahashon & Company" },
      { name: "description", content: "Policy-driven tax filing: obligation checklist and filing progress." },
    ],
  }),
  component: TaxPage,
});

// Page shell only. Data, filters and actions live in use-tax-page; each tab is
// its own component under components/tax/.
function TaxPage() {
  const ctx = useTaxPage(Route.useSearch());
  const { tab, setTab, loading } = ctx;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Tax</h1>
        <p className="text-sm text-muted-foreground">Each tax type follows its own policy — file the current period and the next one is scheduled automatically.</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm border-b-2 transition-colors ${tab === t ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t}</button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && tab === "Overview" && <OverviewTab ctx={ctx} />}
      {!loading && tab === "Checklist" && <ChecklistTab ctx={ctx} />}
      {!loading && tab === "Filing Record" && <FilingRecordTab ctx={ctx} />}
      {!loading && tab === "Annual Filing Record" && <AnnualTab ctx={ctx} />}

      <TaxDialogs ctx={ctx} />
    </div>
  );
}
