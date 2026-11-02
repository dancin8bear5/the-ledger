-- Cash-game (chip count) support. Additive and nullable: existing games keep
-- working unchanged (null mode = inferred winner/split from payouts).
alter table public.games
  add column if not exists mode text check (mode in ('winner', 'split', 'chips')),
  add column if not exists chip_dollars integer check (chip_dollars > 0),
  add column if not exists chip_count integer check (chip_count > 0);

-- Ending chip stack per player (null = not counted yet).
alter table public.game_lines
  add column if not exists chips integer check (chips >= 0);
