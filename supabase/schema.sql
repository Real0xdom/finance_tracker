-- Ocular storage schema for supabase.
-- Run this once in the supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Each user's app data (budgets, settings) is stored as one JSON document per key,
-- protected by row level security so users can only ever access their own rows.

create table if not exists public.user_data (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_data enable row level security;

drop policy if exists "users read own data" on public.user_data;
create policy "users read own data" on public.user_data
  for select using ((select auth.uid()) = user_id);

drop policy if exists "users insert own data" on public.user_data;
create policy "users insert own data" on public.user_data
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "users update own data" on public.user_data;
create policy "users update own data" on public.user_data
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "users delete own data" on public.user_data;
create policy "users delete own data" on public.user_data
  for delete using ((select auth.uid()) = user_id);

-- keep updated_at fresh on every write
create or replace function public.touch_user_data_updated_at()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_data_touch_updated_at on public.user_data;
create trigger user_data_touch_updated_at
  before update on public.user_data
  for each row execute function public.touch_user_data_updated_at();
