-- The Ledger — database schema (applied to Supabase project the-ledger).
-- Money is stored as whole-dollar integers. Access is gated in practice by the
-- unguessable trip UUID carried in the share link (see README security note).

create extension if not exists pgcrypto;

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  code text unique not null default upper(substr(md5(random()::text), 1, 6)),
  name text not null,
  default_buyin integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  buyin integer not null default 0,
  played_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.game_lines (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  contribution integer not null default 0,
  payout integer not null default 0
);

create index on public.players (trip_id);
create index on public.games (trip_id);
create index on public.game_lines (game_id);
create index on public.game_lines (player_id);

-- Realtime DELETE events need the full old row so clients can react.
alter table public.trips replica identity full;
alter table public.players replica identity full;
alter table public.games replica identity full;
alter table public.game_lines replica identity full;

alter table public.trips enable row level security;
alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.game_lines enable row level security;

-- Permissive anon policies. Access is gated in practice by the unguessable trip
-- id/code carried in the share link. Suitable for a low-stakes private tool.
create policy "anon_all_trips" on public.trips for all to anon using (true) with check (true);
create policy "anon_all_players" on public.players for all to anon using (true) with check (true);
create policy "anon_all_games" on public.games for all to anon using (true) with check (true);
create policy "anon_all_game_lines" on public.game_lines for all to anon using (true) with check (true);

-- Live sync
alter publication supabase_realtime add table public.trips;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.game_lines;
