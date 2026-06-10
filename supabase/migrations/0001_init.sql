-- Euro 2026 Expenses Splitter — schema, RLS and receipts bucket.

create extension if not exists "pgcrypto";

-- Trips ---------------------------------------------------------------------
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our trip',
  owe_percentage numeric not null default 25,
  home_currency text not null default 'AUD',
  join_code text not null unique,
  created_at timestamptz not null default now()
);

-- Trip members (who can see/edit a trip) ------------------------------------
create table if not exists public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'me',
  primary key (trip_id, user_id)
);

-- Expenses ------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  amount numeric not null,
  currency text not null check (currency in ('EUR','GBP','AUD')),
  paid_by text not null check (paid_by in ('wife','me')),
  is_business boolean not null default true,
  note text not null default '',
  receipt_path text,
  spent_at timestamptz not null default now(),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create index if not exists expenses_trip_updated_idx
  on public.expenses (trip_id, updated_at);

-- Membership helper (security definer avoids recursive RLS) ------------------
create or replace function public.is_trip_member(t uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = t and m.user_id = auth.uid()
  );
$$;

-- RLS -----------------------------------------------------------------------
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.expenses enable row level security;

-- trips: only members can read/update; joining by code goes through join_trip()
drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips
  for select using (public.is_trip_member(id));

drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips
  for insert with check (auth.uid() is not null);

drop policy if exists trips_update on public.trips;
create policy trips_update on public.trips
  for update using (public.is_trip_member(id));

-- trip_members: a user manages their own membership rows
drop policy if exists members_select on public.trip_members;
create policy members_select on public.trip_members
  for select using (user_id = auth.uid() or public.is_trip_member(trip_id));

drop policy if exists members_insert on public.trip_members;
create policy members_insert on public.trip_members
  for insert with check (user_id = auth.uid());

drop policy if exists members_delete on public.trip_members;
create policy members_delete on public.trip_members
  for delete using (user_id = auth.uid());

-- expenses: restricted to trip members
drop policy if exists expenses_all on public.expenses;
create policy expenses_all on public.expenses
  for all using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));

-- Join a trip by code without exposing the trips table to non-members --------
create or replace function public.join_trip(p_code text, p_display_name text)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare t public.trips;
begin
  select * into t from public.trips where join_code = upper(p_code);
  if t.id is null then
    raise exception 'No trip found for that code';
  end if;
  insert into public.trip_members (trip_id, user_id, display_name)
    values (t.id, auth.uid(), coalesce(p_display_name, 'me'))
    on conflict (trip_id, user_id) do update set display_name = excluded.display_name;
  return t;
end;
$$;

-- Receipts storage bucket ---------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Storage objects keyed as "<trip_id>/<expense_id>.<ext>" — members only.
drop policy if exists receipts_rw on storage.objects;
create policy receipts_rw on storage.objects
  for all
  using (
    bucket_id = 'receipts'
    and public.is_trip_member((split_part(name, '/', 1))::uuid)
  )
  with check (
    bucket_id = 'receipts'
    and public.is_trip_member((split_part(name, '/', 1))::uuid)
  );
