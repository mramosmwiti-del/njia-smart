import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoami from "./tools/whoami";
import listClients from "./tools/list_clients";
import listTasks from "./tools/list_tasks";
import listInvoices from "./tools/list_invoices";

// OAuth issuer MUST be the direct Supabase host (not the .lovable.cloud proxy).
// VITE_SUPABASE_PROJECT_ID is inlined by Vite at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "gk-nahashon-mcp",
  title: "G.K Nahashon & Company",
  version: "0.1.0",
  instructions:
    "Read-only tools for the G.K Nahashon & Company office management platform. Use `whoami` to confirm the signed-in user, `list_clients` to browse firm clients, `list_tasks` to review team tasks, and `list_invoices` to inspect billing. All calls run as the signed-in staff user under row-level security.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoami, listClients, listTasks, listInvoices],
});
