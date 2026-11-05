-- Reconstructed baseline: chat tables (original creation migration is missing).
-- Later migrations (20260925180000 onward) replace every policy here, so only
-- the structure matters. Idempotent. See README.md in this folder.

create table if not exists public.chat_channels (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('team', 'client', 'dm', 'group')),
  name       text,
  client_id  uuid references public.clients(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_channel_members (
  id           uuid primary key default gen_random_uuid(),
  channel_id   uuid not null references public.chat_channels(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (channel_id, user_id)
);

create table if not exists public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  channel_id      uuid not null references public.chat_channels(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  body            text,
  attachment_path text,
  attachment_name text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_chat_messages_channel_created on public.chat_messages (channel_id, created_at);
create index if not exists idx_chat_members_user on public.chat_channel_members (user_id);
create index if not exists idx_chat_channels_client on public.chat_channels (client_id);

alter table public.chat_channels        enable row level security;
alter table public.chat_channel_members enable row level security;
alter table public.chat_messages        enable row level security;

grant select, insert, update, delete on public.chat_channels        to authenticated;
grant select, insert, update, delete on public.chat_channel_members to authenticated;
grant select, insert, update, delete on public.chat_messages        to authenticated;
grant all on public.chat_channels, public.chat_channel_members, public.chat_messages to service_role;

-- The chat page expects exactly one shared team channel to exist.
insert into public.chat_channels (kind, name)
select 'team', 'Team Chat'
where not exists (select 1 from public.chat_channels where kind = 'team');

-- Attachments bucket (made private by 20260926150000).
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do nothing;

do $$ begin
  begin alter publication supabase_realtime add table public.chat_messages;        exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.chat_channel_members; exception when duplicate_object then null; end;
end $$;
