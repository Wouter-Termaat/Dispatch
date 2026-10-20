-- Dispatch: logboek voor statistieken en latere prestaties. Eenmalig plakken in Supabase > SQL Editor > Run.
-- Eén tabel met losse gebeurtenissen (type + vrije JSON), zodat er later zonder nieuwe SQL velden bij kunnen.
-- Zolang deze tabel er niet is, slaat de app de gebeurtenissen gewoon over; er gaat niets mis.

create table if not exists public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  type text not null,
  session uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists events_user_idx on public.events(user_id, created_at);
create index if not exists events_type_idx on public.events(type, created_at);
create index if not exists events_session_idx on public.events(session);

alter table public.events enable row level security;
grant select, insert, delete on public.events to authenticated;
grant usage on sequence public.events_id_seq to authenticated;
revoke all on public.events from anon;

-- iedereen die is ingelogd mag alles lezen (voor latere vergelijkingen tussen Wouter en Luca), schrijven alleen voor jezelf
drop policy if exists "read events" on public.events;
create policy "read events" on public.events for select to authenticated using (true);
drop policy if exists "add own events" on public.events;
create policy "add own events" on public.events for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "delete own events" on public.events;
create policy "delete own events" on public.events for delete to authenticated using (user_id = auth.uid());
