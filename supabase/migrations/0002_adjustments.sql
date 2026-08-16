-- The Ledger — adjustments (cash handoffs / shared expenses) + custom_games.
-- Idempotent: safe to run whether or not 0001/custom_games were already applied.

create table if not exists public.custom_games (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz not null default now()
);
alter table public.custom_games replica identity full;
alter table public.custom_games enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='custom_games' and policyname='anon_all_custom_games') then
    create policy "anon_all_custom_games" on public.custom_games for all to anon using (true) with check (true);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='custom_games') then
    alter publication supabase_realtime add table public.custom_games;
  end if;
end $$;

-- Side entries outside of games. lines = [{"player_id": uuid, "delta": int}], sum(delta)=0.
-- delta > 0 means the player is owed that much more at settlement.
create table if not exists public.adjustments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  kind text not null default 'cash',
  note text not null default '',
  amount integer not null default 0,
  lines jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index if not exists adjustments_trip_id_idx on public.adjustments (trip_id);
alter table public.adjustments replica identity full;
alter table public.adjustments enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='adjustments' and policyname='anon_all_adjustments') then
    create policy "anon_all_adjustments" on public.adjustments for all to anon using (true) with check (true);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='adjustments') then
    alter publication supabase_realtime add table public.adjustments;
  end if;
end $$;
