import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Minimal typed wrapper for the Supabase auth.oauth beta namespace.
type AuthorizationDetails = {
  client?: { name?: string; client_uri?: string };
  redirect_url?: string;
  redirect_to?: string;
  scopes?: string[];
};
type OauthResult = { data: AuthorizationDetails | null; error: { message: string } | null };
type OauthNs = {
  getAuthorizationDetails: (id: string) => Promise<OauthResult>;
  approveAuthorization: (id: string) => Promise<OauthResult>;
  denyAuthorization: (id: string) => Promise<OauthResult>;
};
function oauthNs(): OauthNs {
  return (supabase.auth as unknown as { oauth: OauthNs }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) {
      throw redirect({ to: "/login", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthNs().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-sm text-muted-foreground">
        Could not load this authorization request: {String((error as Error)?.message ?? error)}
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "an external app";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauthNs().approveAuthorization(authorization_id)
      : await oauthNs().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md bg-card border rounded-lg p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Connect {clientName} to G.K Nahashon & Company</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {clientName} is asking to access this workspace on your behalf. It will act as your
            signed-in staff account and can only see data your row-level permissions allow.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Please wait…" : "Approve"}
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 h-10 rounded-md border text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            Deny
          </button>
        </div>
      </div>
    </main>
  );
}
