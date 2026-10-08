import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/advisory")({
  head: () => ({
    meta: [
      { title: "Advisory | G.K Nahashon & Company" },
      {
        name: "description",
        content: "Advisory workspace.",
      },
    ],
  }),
  component: AdvisoryPage,
});

function AdvisoryPage() {
  return (
    <div className="p-6">
      {/* Advisory workflow intentionally left blank for the new workflow design. */}
    </div>
  );
}
