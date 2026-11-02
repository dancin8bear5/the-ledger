-- Rebuy count per player per game (display/history only; contribution stays the
-- money source of truth and already includes every rebuy).
alter table public.game_lines
  add column if not exists rebuys integer not null default 0 check (rebuys >= 0);
