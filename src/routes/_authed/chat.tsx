import { createFileRoute, useSearch } from "@tanstack/react-router";
import { openStoredFile } from "@/lib/client-files";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ChatTicks, ReceiptRow, receiptFor, overallReceipt, type MemberReceipt } from "@/components/chat-receipts";
import {
  Hash, Users2, Plus, Send, Paperclip, X, Loader2, MessageSquare, Trash2, Ban, ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/_authed/chat")({
  component: ChatPage,
  validateSearch: (s: Record<string, unknown>) => ({ channel: (s.channel as string) || undefined }),
});

type Channel = {
  id: string;
  kind: "team" | "dm" | "group";
  name: string | null;
  created_by: string | null;
  created_at: string;
};

type Message = {
  id: string;
  channel_id: string;
  sender_id: string;
  body: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  created_at: string;
  deleted_at?: string | null;
};

type Profile = { id: string; full_name: string | null; avatar_url: string | null };

// Delete icon on each message. Phones and tablets have no hover, so it is
// always visible there (with a bigger tap target); on a mouse it stays hidden
// until you hover the message.
const DELETE_BTN =
  "shrink-0 p-2 -my-1 text-muted-foreground hover:text-destructive active:text-destructive " +
  "opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100";

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

function ChatPage() {
  const { user } = useAuth();
  const search = useSearch({ from: "/_authed/chat" });

  const [channels, setChannels] = useState<Channel[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [profileById, setProfileById] = useState<Record<string, Profile>>({});
  const [activeId, setActiveId] = useState<string | null>(search.channel ?? null);
  // Phones show the chat list OR the conversation (like WhatsApp); wider screens show both.
  const [mobileChat, setMobileChat] = useState<boolean>(!!search.channel);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [unreadChannelIds, setUnreadChannelIds] = useState<Set<string>>(new Set());
  const [dmOtherUserId, setDmOtherUserId] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);
  // Read receipts: where each member has got to in the open chat.
  const [memberReceipts, setMemberReceipts] = useState<MemberReceipt[]>([]);
  const [infoTarget, setInfoTarget] = useState<Message | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelsRef = useRef<Channel[]>([]);
  channelsRef.current = channels;

  // ---- load sidebar data --------------------------------------------------
  async function loadChannels() {
    const [chRes, memRes] = await Promise.all([
      supabase.from("chat_channels").select("*").order("created_at"),
      user
        ? supabase.from("chat_channel_members").select("channel_id, hidden_at").eq("user_id", user.id)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    // DMs/groups are private: show only team chat and channels I'm a member
    // of. (The DB policy enforces this too; this keeps the sidebar blank for
    // anyone who hasn't been messaged, even if a loose policy slips through.)
    // Chats I deleted (hidden_at set) stay out of the list until someone
    // writes again — the DB then clears hidden_at.
    const mine = new Set(((memRes.data as any[]) ?? []).filter((m) => !m.hidden_at).map((m) => m.channel_id));
    const visible = ((chRes.data as Channel[]) ?? []).filter((c) => c.kind === "team" || mine.has(c.id));
    setChannels(visible);
  }
  async function loadDirectory() {
    const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").order("full_name");
    const list = (data as Profile[]) ?? [];
    setStaff(list.filter((p) => p.id !== user?.id));
    setProfileById(Object.fromEntries(list.map((p) => [p.id, p])));
  }
  useEffect(() => { loadChannels(); loadDirectory(); }, [user?.id]);

  // A message in a chat that isn't in my list (e.g. one I deleted) brings it
  // back. RLS means I only receive events for chats I'm a member of.
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("chat-new-conversations-" + user.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const cid = (payload.new as any)?.channel_id;
          if (cid && !channelsRef.current.some((c) => c.id === cid)) loadChannels();
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  // ---- who's on the other side of each DM (so the sidebar can show a
  // real name instead of the generic "Direct message" label) -------------
  async function loadDmOtherUsers(dmIds: string[]) {
    if (!user || dmIds.length === 0) return;
    const { data } = await supabase
      .from("chat_channel_members")
      .select("channel_id, user_id")
      .in("channel_id", dmIds);
    const byChannel: Record<string, string> = {};
    (data ?? []).forEach((m: any) => {
      if (m.user_id !== user.id) byChannel[m.channel_id] = m.user_id;
    });
    setDmOtherUserId((prev) => ({ ...prev, ...byChannel }));
  }
  useEffect(() => {
    const dmIds = channels.filter((c) => c.kind === "dm").map((c) => c.id);
    if (dmIds.length) loadDmOtherUsers(dmIds);
  }, [channels, user?.id]);

  // ---- unread indicators (driven by the chat_message notifications the
  // db trigger already creates — no extra schema needed) -----------------
  async function loadUnread() {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("link")
      .eq("user_id", user.id).eq("type", "chat_message").is("read_at", null);
    const ids = new Set<string>();
    (data ?? []).forEach((n: any) => {
      const m = n.link?.match(/channel=([0-9a-f-]+)/i);
      if (m) ids.add(m[1]);
    });
    setUnreadChannelIds(ids);
  }
  useEffect(() => { loadUnread(); }, [user?.id]);
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("chat-unread-list-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, loadUnread)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  async function markChannelRead(channelId: string) {
    if (!user) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("type", "chat_message").is("read_at", null)
      .ilike("link", `%channel=${channelId}%`);
    setUnreadChannelIds((prev) => {
      if (!prev.has(channelId)) return prev;
      const next = new Set(prev);
      next.delete(channelId);
      return next;
    });
  }

  // pick a sensible default channel once loaded
  useEffect(() => {
    if (activeId || channels.length === 0) return;
    const team = channels.find((c) => c.kind === "team");
    setActiveId(team?.id ?? channels[0]?.id ?? null);
  }, [channels, activeId]);

  // ---- load + subscribe to messages for the active channel ---------------
  async function loadMessages(channelId: string) {
    const [msgRes, memRes, hideRes] = await Promise.all([
      supabase.from("chat_messages").select("*").eq("channel_id", channelId).order("created_at"),
      user
        ? supabase.from("chat_channel_members").select("cleared_at").eq("channel_id", channelId).eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null as any }),
      user
        ? supabase.from("chat_message_hides").select("message_id").eq("user_id", user.id)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    // Personal view only: hide what I cleared or deleted for myself.
    const clearedAt = (memRes.data as any)?.cleared_at as string | null | undefined;
    const hidden = new Set(((hideRes.data as any[]) ?? []).map((h) => h.message_id));
    const visible = ((msgRes.data as Message[]) ?? []).filter(
      (m) => !hidden.has(m.id) && (!clearedAt || m.created_at > clearedAt),
    );
    setMessages(visible);
  }

  // ---- read receipts (ticks) ----------------------------------------------
  async function loadReceipts(channelId: string) {
    const full = await supabase.from("chat_channel_members")
      .select("user_id, last_read_at, last_delivered_at, created_at").eq("channel_id", channelId);
    if (!full.error) {
      setMemberReceipts(((full.data as any[]) ?? []).map((r) => ({ ...r, joined_at: r.created_at })));
      return;
    }
    // Database update not applied yet: fall back to read times only.
    const basic = await supabase.from("chat_channel_members")
      .select("user_id, last_read_at, created_at").eq("channel_id", channelId);
    setMemberReceipts(((basic.data as any[]) ?? []).map((r) => ({ ...r, last_delivered_at: null, joined_at: r.created_at })));
  }

  // "I have this chat open and have read it" (server time, so clocks can't fake it).
  async function markReceiptsRead(channelId: string) {
    if (!user || document.visibilityState !== "visible") return;
    const { error } = await supabase.rpc("chat_mark_read" as any, { _channel_id: channelId } as any);
    if (error) {
      await supabase.from("chat_channel_members").upsert(
        { channel_id: channelId, user_id: user.id, last_read_at: new Date().toISOString() },
        { onConflict: "channel_id,user_id" },
      );
    }
  }

  // The delete dialog (deleteTarget) is the confirmation for both options.
  async function deleteMessageForMe(id: string) {
    const { error } = await supabase.rpc("hide_chat_message_for_me", { _message_id: id });
    if (error) { toast.error(error.message); return; }
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setDeleteTarget(null);
  }

  // Sender only: the message stays in the thread for everyone as "This message was deleted".
  async function deleteMessageForEveryone(m: Message) {
    const { data, error } = await supabase.rpc("delete_chat_message_for_everyone" as any, { _message_id: m.id } as any);
    if (error) { toast.error(error.message); return; }
    setMessages((prev) => prev.map((x) => x.id === m.id
      ? { ...x, body: null, attachment_path: null, attachment_name: null, deleted_at: new Date().toISOString() }
      : x));
    setDeleteTarget(null);
    // Best effort: remove the stored file too.
    const path = (data as unknown as string | null) ?? null;
    if (path) void supabase.storage.from("chat-attachments").remove([path]);
  }

  async function deleteChatForMe() {
    if (!activeId || !active || active.kind === "team") return;
    if (!confirm(`Delete your chat with ${channelLabel(active)}? It will be removed from your list. The other person will still have their copy.`)) return;
    const { error } = await supabase.rpc("delete_chat_for_me", { _channel_id: activeId });
    if (error) { toast.error(error.message); return; }
    const remaining = channels.filter((c) => c.id !== activeId);
    setChannels(remaining);
    setMessages([]);
    setActiveId(remaining.find((c) => c.kind === "team")?.id ?? remaining[0]?.id ?? null);
    setMobileChat(false);
    toast.success("Chat deleted");
  }

  async function clearChatForMe() {
    if (!activeId) return;
    if (!confirm("Clear this chat for you? The other person will still see the messages.")) return;
    const { error } = await supabase.rpc("clear_chat_for_me", { _channel_id: activeId });
    if (error) { toast.error(error.message); return; }
    setMessages([]);
    toast.success("Chat cleared");
  }

  useEffect(() => {
    if (!activeId) return;
    loadMessages(activeId);
    const ch = supabase
      .channel(`chat-${activeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${activeId}` },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) => [...prev, incoming]);
          // A message from someone else arrived while I'm looking at the chat: I've read it.
          if (incoming.sender_id !== user?.id) { void markReceiptsRead(activeId); void markChannelRead(activeId); }
        })
      // Someone deleted a message for everyone: show it as deleted straight away.
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `channel_id=eq.${activeId}` },
        (payload) => {
          const next = payload.new as Message;
          setMessages((prev) => prev.map((x) => (x.id === next.id ? { ...x, ...next } : x)));
        })
      // Someone's delivered/read marker moved: update the ticks live.
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_channel_members", filter: `channel_id=eq.${activeId}` },
        (payload) => {
          const row = payload.new as any;
          if (!row?.user_id) return;
          setMemberReceipts((prev) => [
            ...prev.filter((r) => r.user_id !== row.user_id),
            { user_id: row.user_id, last_read_at: row.last_read_at ?? null, last_delivered_at: row.last_delivered_at ?? null, joined_at: row.created_at ?? null },
          ]);
        })
      .subscribe();
    setMemberReceipts([]);
    loadReceipts(activeId);
    // mark read
    if (user) {
      void markReceiptsRead(activeId);
      markChannelRead(activeId);
    }
    // Coming back to the tab with this chat open counts as reading it.
    const onVisible = () => { if (document.visibilityState === "visible") void markReceiptsRead(activeId); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { supabase.removeChannel(ch); document.removeEventListener("visibilitychange", onVisible); };
  }, [activeId, user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const active = useMemo(() => channels.find((c) => c.id === activeId) ?? null, [channels, activeId]);
  const otherReceipts = useMemo(() => memberReceipts.filter((r) => r.user_id !== user?.id), [memberReceipts, user?.id]);

  function channelLabel(c: Channel) {
    if (c.kind === "team") return "Team Chat";
    if (c.kind === "dm") {
      const otherId = dmOtherUserId[c.id];
      const name = otherId ? profileById[otherId]?.full_name : null;
      return name ?? c.name ?? "Direct message";
    }
    return c.name ?? "Group chat";
  }
  function channelIcon(c: Channel) {
    if (c.kind === "team") return <Hash className="h-4 w-4" />;
    return <Users2 className="h-4 w-4" />;
  }

  const teamChannel = channels.find((c) => c.kind === "team");
  const dmChannels = channels.filter((c) => c.kind === "dm" || c.kind === "group");

  // ---- actions -------------------------------------------------------------
  async function openOrCreateDm(otherUserId: string) {
    const { data: channelId, error } = await supabase.rpc("get_or_create_dm", { _other_user_id: otherUserId });
    if (error) { toast.error(error.message); return; }
    await loadChannels();
    setActiveId(channelId as string);
    setMobileChat(true);
    setPickerOpen(false);
  }

  async function send() {
    if (!activeId || (!body.trim() && !file) || sending) return;
    setSending(true);
    try {
      let attachment_path: string | null = null;
      let attachment_name: string | null = null;
      if (file) {
        const path = `${activeId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("chat-attachments").upload(path, file);
        if (upErr) { toast.error(upErr.message); setSending(false); return; }
        attachment_path = path;
        attachment_name = file.name;
      }
      const { error } = await supabase.from("chat_messages").insert({
        channel_id: activeId, sender_id: user!.id,
        body: body.trim() || null, attachment_path, attachment_name,
      });
      if (error) { toast.error(error.message); return; }
      setBody(""); setFile(null);
    } finally {
      setSending(false);
    }
  }

  async function downloadAttachment(path: string) {
    await openStoredFile("chat-attachments", path, 300);
  }

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] md:h-[calc(100dvh-6.5rem)] -m-4 md:-m-6 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${mobileChat ? "hidden md:flex" : "flex"} w-full md:w-64 shrink-0 border-r bg-card flex-col`}>
        <div className="p-4 border-b flex items-center gap-2 font-semibold text-sm">
          <MessageSquare className="h-4 w-4" /> Chat
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {teamChannel && (
            <SidebarItem active={activeId === teamChannel.id} onClick={() => { setActiveId(teamChannel.id); setMobileChat(true); }} icon={<Hash className="h-4 w-4" />} label="Team Chat" unread={unreadChannelIds.has(teamChannel.id)} />
          )}

          <SidebarSection label="Direct messages" onAdd={() => setPickerOpen(true)} unread={dmChannels.some((c) => unreadChannelIds.has(c.id))} />
          {dmChannels.map((c) => (
            <SidebarItem key={c.id} active={activeId === c.id} onClick={() => { setActiveId(c.id); setMobileChat(true); }} icon={<Users2 className="h-4 w-4" />} label={channelLabel(c)} unread={unreadChannelIds.has(c.id)} />
          ))}
          {dmChannels.length === 0 && <div className="px-4 py-1 text-xs text-muted-foreground">No conversations yet</div>}
        </div>
      </aside>

      {/* Main pane */}
      <div className={`${mobileChat ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}>
        {active ? (
          <>
            <div className="h-14 border-b flex items-center gap-2 px-2 md:px-4 font-medium">
              <button onClick={() => setMobileChat(false)} aria-label="Back to chats" className="md:hidden p-2 rounded-md hover:bg-muted">
                <ArrowLeft className="h-5 w-5" />
              </button>
              {channelIcon(active)} <span className="truncate min-w-0">{channelLabel(active)}</span>
              <div className="ml-auto flex items-center gap-3 md:gap-4 shrink-0">
                {active.kind === "team" && (
                  <button onClick={clearChatForMe} className="text-xs font-normal text-muted-foreground hover:text-destructive inline-flex items-center gap-1">
                    <Trash2 className="h-3.5 w-3.5" /> Clear chat
                  </button>
                )}
                {active.kind !== "team" && (
                  <button onClick={deleteChatForMe} className="text-xs font-normal text-muted-foreground hover:text-destructive inline-flex items-center gap-1">
                    <X className="h-3.5 w-3.5" /> Delete chat
                  </button>
                )}
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => {
                const mine = m.sender_id === user?.id;
                const p = profileById[m.sender_id];
                return (
                  <div key={m.id} className={`group flex items-start gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                    {mine && (
                      <button onClick={() => setDeleteTarget(m)} title="Delete message" aria-label="Delete message" className={DELETE_BTN}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!mine && (
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                        {initials(p?.full_name)}
                      </div>
                    )}
                    <div className={`max-w-md rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {!mine && <div className="text-xs font-semibold mb-0.5 opacity-70">{p?.full_name ?? "Unknown"}</div>}
                      {m.deleted_at ? (
                        <div className="flex items-center gap-1.5 italic opacity-80">
                          <Ban className="h-3.5 w-3.5 shrink-0" /> {mine ? "You deleted this message" : "This message was deleted"}
                        </div>
                      ) : (
                        <>
                          {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
                          {m.attachment_path && (
                            <button onClick={() => downloadAttachment(m.attachment_path!)} className="mt-1 flex items-center gap-1 text-xs underline underline-offset-2">
                              <Paperclip className="h-3 w-3" /> {m.attachment_name ?? "Attachment"}
                            </button>
                          )}
                        </>
                      )}
                      <div className={`text-[10px] mt-1 flex items-center gap-1 ${mine ? "justify-end text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                        {mine && !m.deleted_at && (
                          <ChatTicks state={overallReceipt(m.created_at, otherReceipts)} onClick={() => setInfoTarget(m)} />
                        )}
                      </div>
                    </div>
                    {!mine && (
                      <button onClick={() => setDeleteTarget(m)} title="Delete message" aria-label="Delete message" className={DELETE_BTN}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
              {messages.length === 0 && <div className="text-center text-sm text-muted-foreground pt-10">No messages yet — say hello.</div>}
            </div>
            <div className="border-t p-3">
              {file && (
                <div className="mb-2 flex items-center gap-2 text-xs bg-muted rounded px-2 py-1 w-fit">
                  <Paperclip className="h-3 w-3" /> {file.name}
                  <button onClick={() => setFile(null)}><X className="h-3 w-3" /></button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <label className="p-2 rounded-md hover:bg-muted cursor-pointer">
                  <Paperclip className="h-4 w-4" />
                  <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
                <input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Message…"
                  className="flex-1 border rounded-md px-3 py-2 text-sm bg-background"
                />
                <button onClick={send} disabled={sending || (!body.trim() && !file)} className="p-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Select a channel to start chatting</div>
        )}
      </div>

      {/* Message info: who has received and read my message */}
      {infoTarget && (
        <Picker title="Message info" onClose={() => setInfoTarget(null)}>
          <div className="px-3 py-2 text-xs text-muted-foreground border-b mb-1">
            <div className="line-clamp-2 break-words">{infoTarget.body || infoTarget.attachment_name || "Attachment"}</div>
            <div className="mt-0.5">Sent {new Date(infoTarget.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</div>
          </div>
          {otherReceipts.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No one else is in this chat yet.</div>}
          {[...otherReceipts]
            .sort((a, b) => (profileById[a.user_id]?.full_name ?? "").localeCompare(profileById[b.user_id]?.full_name ?? ""))
            .map((r) => (
              <ReceiptRow key={r.user_id} name={profileById[r.user_id]?.full_name ?? "Unknown"} state={receiptFor(infoTarget.created_at, r)} />
            ))}
        </Picker>
      )}

      {/* Delete message: for everyone (own messages only) or just for me */}
      {deleteTarget && (
        <Picker title="Delete message?" onClose={() => setDeleteTarget(null)}>
          {deleteTarget.sender_id === user?.id && !deleteTarget.deleted_at && (
            <button onClick={() => deleteMessageForEveryone(deleteTarget)} className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm">
              <div className="font-medium text-destructive">Delete for everyone</div>
              <div className="text-xs text-muted-foreground">Removes it for everyone in this chat. They will see "This message was deleted".</div>
            </button>
          )}
          <button onClick={() => deleteMessageForMe(deleteTarget.id)} className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm">
            <div className="font-medium">Delete for me</div>
            <div className="text-xs text-muted-foreground">Only removes it from your view. Everyone else still sees it.</div>
          </button>
          <button onClick={() => setDeleteTarget(null)} className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm text-muted-foreground">Cancel</button>
        </Picker>
      )}

      {/* DM picker */}
      {pickerOpen && (
        <Picker title="Message a colleague" onClose={() => setPickerOpen(false)}>
          {staff.map((p) => (
            <button key={p.id} onClick={() => openOrCreateDm(p.id)} className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold">{initials(p.full_name)}</div>
              {p.full_name ?? "Unnamed"}
            </button>
          ))}
        </Picker>
      )}
    </div>
  );
}

function SidebarItem({ active, onClick, icon, label, unread }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; unread?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left ${
        active
          ? "bg-primary/10 text-primary font-medium"
          : unread
            ? "bg-accent/10 text-foreground font-semibold hover:bg-accent/15"
            : "hover:bg-muted text-foreground/90"
      }`}
    >
      {icon} <span className="truncate flex-1">{label}</span>
      {unread && <span className="h-2 w-2 rounded-full bg-accent shrink-0" />}
    </button>
  );
}

function SidebarSection({ label, onAdd, unread }: { label: string; onAdd: () => void; unread?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-1">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {unread && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
      </span>
      <button onClick={onAdd} className="p-0.5 rounded hover:bg-muted"><Plus className="h-3.5 w-3.5 text-muted-foreground" /></button>
    </div>
  );
}

function Picker({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border rounded-lg shadow-lg w-full max-w-sm max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-semibold text-sm">{title}</div>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="p-2 space-y-0.5">{children}</div>
      </div>
    </div>
  );
}
