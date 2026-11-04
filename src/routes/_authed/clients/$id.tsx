import { createFileRoute, useParams } from "@tanstack/react-router";
import { useClientDetail } from "@/components/client-detail/use-client-detail";
import { ClientHeader } from "@/components/client-detail/client-header";
import { ClientTabs } from "@/components/client-detail/client-tabs";
import { EditClientDialog } from "@/components/client-detail/edit-client-dialog";
import { AddRecordDialog } from "@/components/client-detail/add-record-dialog";

export const Route = createFileRoute("/_authed/clients/$id")({
  // Optional deep link: ?tab=Tax&obligation=vat opens that tab and scrolls to
  // that obligation (used by the assignee chip on the Tax pages).
  validateSearch: (s: Record<string, unknown>): { tab?: string; obligation?: string } => ({
    ...(typeof s.tab === "string" ? { tab: s.tab } : {}),
    ...(typeof s.obligation === "string" ? { obligation: s.obligation } : {}),
  }),
  component: ClientDetail,
});

// Page shell only. Data + actions live in use-client-detail; the header, tabs
// and dialogs are components under components/client-detail/.
function ClientDetail() {
  const { id } = useParams({ from: "/_authed/clients/$id" });
  const ctx = useClientDetail(id, Route.useSearch());

  if (!ctx.client) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <ClientHeader ctx={ctx} />
      <ClientTabs ctx={ctx} />
      <EditClientDialog ctx={ctx} />
      <AddRecordDialog ctx={ctx} />
    </div>
  );
}
