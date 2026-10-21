-- Dispatch: de ideeënbus. Eenmalig plakken in Supabase > SQL Editor > Run.
-- Wouter en Luca posten hier ideeën en bugs; in een sessie met Claude gaan we ze langs en zetten we de status (en eventueel een antwoord).
-- Zolang deze tabel er niet is, bewaart de app nieuwe briefjes op het toestel en verstuurt ze zodra de tabel bestaat.

create table if not exists public.ideas (
  id uuid primary key,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('idee', 'bug')),
  text text not null check (char_length(text) between 1 and 2000),
  status text not null default 'nieuw' check (status in ('nieuw', 'gepland', 'gedaan', 'niet')),
  reply text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ideas_created_idx on public.ideas(created_at);

alter table public.ideas enable row level security;
grant select, insert, update, delete on public.ideas to authenticated;
revoke all on public.ideas from anon;

-- iedereen die is ingelogd ziet de hele bus en mag de status bijwerken; posten en terughalen alleen je eigen briefjes
drop policy if exists "read ideas" on public.ideas;
create policy "read ideas" on public.ideas for select to authenticated using (true);
drop policy if exists "add own ideas" on public.ideas;
create policy "add own ideas" on public.ideas for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "update ideas" on public.ideas;
create policy "update ideas" on public.ideas for update to authenticated using (true) with check (true);
drop policy if exists "delete own ideas" on public.ideas;
create policy "delete own ideas" on public.ideas for delete to authenticated using (user_id = auth.uid());

-- Voorbeeld voor een sessie met Claude: status en antwoord zetten.
-- update public.ideas set status = 'gedaan', reply = 'Staat erin sinds v19.', updated_at = now() where id = '...';
