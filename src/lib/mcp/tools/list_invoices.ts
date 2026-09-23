import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function client(ctx: ToolContext) {
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_invoices",
  title: "List invoices",
  description:
    "List billing invoices visible to the signed-in staff user. Optionally filter by status (draft, sent, partial, paid, overdue) or client_id.",
  inputSchema: {
    status: z.enum(["draft", "sent", "partial", "paid", "overdue"]).optional(),
    client_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, client_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = client(ctx);
    let q = supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(limit);
    if (status) q = q.eq("status", status);
    if (client_id) q = q.eq("client_id", client_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { invoices: data ?? [] },
    };
  },
});
