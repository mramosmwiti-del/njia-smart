import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Send, Paperclip, X, Loader2 } from "lucide-react";

type Channel = { id: string; client_id: string | null };
type Message = {
  id: string; channel_id: string; sender_id: string;
  body: string | null; attachment_path: string | null; attachment_name: string | null; created_at: string;
};
type Profile = { id: string; full_name: string | null };

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

/** Drop-in chat panel scoped to one client's channel. Creates the channel on first use. */
export function ClientChatPanel({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profileById, setProfileById] = useState<Record<string, Profile>>({});
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function init() {
      setLoading(true);
      const { data: existing } = await supabase.from("chat_channels").select("id, client_id").eq("client_id", clientId).eq("kind", "client").maybeSingle();
      let ch = existing as Channel | null;
      if (!ch) {
        const { data: created, error } = await supabase.from("chat_channels").insert({ kind: "client", client_id: clientId, created_by: user!.id }).select("id, client_id").single();
        if (error) { toast.error(error.message); setLoading(false); return; }
        ch = created as Channel;
      }
      if (!active) return;
      setChannel(ch);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name");
      if (active) setProfileById(Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p])));
      setLoading(false);
    }
    init();
    return () => { active = false; };
  }, [clientId]);

  useEffect(() => {
    if (!channel) return;
    supabase.from("chat_messages").select("*").eq("channel_id", channel.id).order("created_at").then(({ data }) => setMessages((data as Message[]) ?? []));
    const sub = supabase
      .channel(`chat-client-${channel.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${channel.id}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message]))
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [channel?.id]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages.length]);

  async function send() {
    if (!channel || (!body.trim() && !file) || sending) return;
    setSending(true);
    try {
      let attachment_path: string | null = null;
      let attachment_name: string | null = null;
      if (file) {
        const path = `${channel.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("chat-attachments").upload(path, file);
        if (upErr) { toast.error(upErr.message); setSending(false); return; }
        attachment_path = path; attachment_name = file.name;
      }
      const { error } = await supabase.from("chat_messages").insert({
        channel_id: channel.id, sender_id: user!.id, body: body.trim() || null, attachment_path, attachment_name,
      });
      if (error) { toast.error(error.message); return; }
      setBody(""); setFile(null);
    } finally { setSending(false); }
  }

  async function downloadAttachment(path: string) {
    const { data, error } = await supabase.storage.from("chat-attachments").createSignedUrl(path, 300);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  }

  if (loading) return <div className="text-sm text-muted-foreground py-6 text-center">Loading chat…</div>;

  return (
    <div className="border rounded-lg flex flex-col h-[28rem]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          const p = profileById[m.sender_id];
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
              {!mine && (
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
                  {initials(p?.full_name)}
                </div>
              )}
              <div className={`max-w-xs rounded-lg px-3 py-1.5 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {!mine && <div className="text-xs font-semibold mb-0.5 opacity-70">{p?.full_name ?? "Unknown"}</div>}
                {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
                {m.attachment_path && (
                  <button onClick={() => downloadAttachment(m.attachment_path!)} className="mt-1 flex items-center gap-1 text-xs underline underline-offset-2">
                    <Paperclip className="h-3 w-3" /> {m.attachment_name ?? "Attachment"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {messages.length === 0 && <div className="text-center text-xs text-muted-foreground pt-8">No messages yet for this client.</div>}
      </div>
      <div className="border-t p-2">
        {file && (
          <div className="mb-1.5 flex items-center gap-2 text-xs bg-muted rounded px-2 py-1 w-fit">
            <Paperclip className="h-3 w-3" /> {file.name}
            <button onClick={() => setFile(null)}><X className="h-3 w-3" /></button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="p-1.5 rounded-md hover:bg-muted cursor-pointer">
            <Paperclip className="h-4 w-4" />
            <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Message about this client…"
            className="flex-1 border rounded-md px-3 py-1.5 text-sm bg-background"
          />
          <button onClick={send} disabled={sending || (!body.trim() && !file)} className="p-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
