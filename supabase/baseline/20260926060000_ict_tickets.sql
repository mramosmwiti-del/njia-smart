-- Reconstructed baseline: ICT Service Desk tickets (the original
-- 20260926060000_ict_tickets.sql is missing; later migrations refer to it).
-- Policies below are the starting set; 20260926090000, 20260926120000 and
-- 20260926140000 replace select/update/delete. Idempotent.
-- See README.md in this folder.

create sequence if not exists public.ict_ticket_seq;

create table if not exists public.ict_tickets (
  id            uuid primary key default gen_random_uuid(),
  ticket_number text unique,
  title         text not null,
  description   text,
  category      text,
  priority      text,
  status        text not null default 'New',
  reported_by   uuid not null references auth.users(id) on delete cascade,
  assigned_to   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_ict_tickets_reported_by on public.ict_tickets (reported_by);
create index if not exists idx_ict_tickets_status      on public.ict_tickets (status);

-- Human-readable number, e.g. ICT-0007 (the app shows it as "Ticket ICT-0007 raised").
create or replace function public.tg_ict_ticket_number()
returns trigger language plpgsql as $$
begin
  if new.ticket_number is null then
    new.ticket_number := 'ICT-' || lpad(nextval('public.ict_ticket_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ict_ticket_number on public.ict_tickets;
create trigger trg_ict_ticket_number
  before insert on public.ict_tickets
  for each row execute function public.tg_ict_ticket_number();

drop trigger if exists trg_ict_tickets_updated_at on public.ict_tickets;
create trigger trg_ict_tickets_updated_at
  before update on public.ict_tickets
  for each row execute function public.set_updated_at();

alter table public.ict_tickets enable row level security;

drop policy if exists "ict tickets select own or full module" on public.ict_tickets;
create policy "ict tickets select own or full module" on public.ict_tickets
  for select to authenticated
  using (reported_by = auth.uid() or public.can_view_module_all(auth.uid(), 'ict_service_desk'));

drop policy if exists "ict tickets insert own" on public.ict_tickets;
create policy "ict tickets insert own" on public.ict_tickets
  for insert to authenticated
  with check (reported_by = auth.uid() and public.is_staff(auth.uid()));

drop policy if exists "ict tickets update full module only" on public.ict_tickets;
create policy "ict tickets update full module only" on public.ict_tickets
  for update to authenticated
  using (public.has_full_module(auth.uid(), 'ict_service_desk'))
  with check (public.has_full_module(auth.uid(), 'ict_service_desk'));

grant select, insert, update on public.ict_tickets to authenticated;
grant all on public.ict_tickets to service_role;

do $$ begin
  begin alter publication supabase_realtime add table public.ict_tickets; exception when duplicate_object then null; end;
end $$;
