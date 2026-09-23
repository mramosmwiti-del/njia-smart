import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authed")({
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user, loading, roles } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = window.location.pathname + window.location.search;
      navigate({ to: "/login", search: { next } });
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }
  // Staff gate: if no role yet, show waiting state
  if (roles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">Pending role assignment</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Your account exists but hasn't been assigned a role yet. Please ask the Director or an Admin to assign you a role.
          </p>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login", search: { next: undefined } }); }}
            className="mt-6 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm"
          >Sign out</button>
        </div>
      </div>
    );
  }
  return <AppShell><Outlet /></AppShell>;
}
