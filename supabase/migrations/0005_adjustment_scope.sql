-- Which settlement a cash payment counts toward: 'games' (poker/cash games),
-- 'expenses' (groceries/food), or null = the combined "All" settlement.
alter table public.adjustments
  add column if not exists scope text check (scope in ('games', 'expenses'));
