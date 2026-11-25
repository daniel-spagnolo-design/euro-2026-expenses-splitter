-- Keep-alive heartbeat so the free-tier project isn't auto-paused.
--
-- An anonymous SELECT that RLS filters to [] was NOT counted as activity by
-- Supabase (the project paused on 2026-11-13 despite pings every 3 days).
-- This gives the scheduled GitHub Action a real WRITE to perform instead.

create table if not exists public.keep_alive (
  id smallint primary key default 1 check (id = 1), -- single row, never grows
  pinged_at timestamptz not null default now(),
  ping_count bigint not null default 0
);

-- No policies = no direct table access for anon/authenticated.
alter table public.keep_alive enable row level security;

-- The only way in: bump the heartbeat row and return the new timestamp.
create or replace function public.keep_alive()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  insert into public.keep_alive (id, pinged_at, ping_count)
    values (1, now(), 1)
    on conflict (id) do update
      set pinged_at = now(), ping_count = keep_alive.ping_count + 1
  returning pinged_at;
$$;

revoke all on function public.keep_alive() from public;
grant execute on function public.keep_alive() to anon;
