-- Finance tracker schema. Run once: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Deliberately additive: the legacy Ocular `public.user_data` table is left untouched,
-- so the old app keeps working and the migration can be re-run from it if needed.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- categories
-- One row per spending/income bucket. `kind` decides which card it shows under.
create table if not exists public.ft_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  kind       text not null check (kind in ('expense', 'income', 'investment', 'lending')),
  icon       text not null default 'circle',
  sort       integer not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, kind, name)
);

-- -------------------------------------------------------------- transactions
-- Every money movement is one row here, including lendings and their repayments.
--   expense    money left, gone for good
--   income     money arrived
--   investment money left, still yours (SIPs, emergency fund)
--   lending    money left, expected back -- NOT counted as expense
--   repayment  a lending coming back; `lend_id` points at the original lending row
create table if not exists public.ft_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  occurred_on date not null,
  kind        text not null check (kind in ('expense', 'income', 'investment', 'lending', 'repayment')),
  category_id uuid references public.ft_categories (id) on delete set null,
  note        text not null default '',
  qty         numeric(12, 3) not null default 1,
  amount      numeric(14, 2) not null check (amount >= 0),
  person      text,
  lend_id     uuid references public.ft_transactions (id) on delete set null,
  -- true for rows brought over from the legacy monthly-total data, where the
  -- exact day within the month was never recorded
  imported    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists ft_tx_user_date_idx on public.ft_transactions (user_id, occurred_on desc);
create index if not exists ft_tx_user_kind_idx on public.ft_transactions (user_id, kind);
create index if not exists ft_tx_category_idx  on public.ft_transactions (category_id);

-- ---------------------------------------------------------------- recurring
-- Fixed things that repeat: salary, rent, SIPs, and the every-3-months trip.
-- `every_n_months` = 1 monthly, 3 quarterly. `day_of_month` is when it is due.
create table if not exists public.ft_recurring (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  label          text not null,
  kind           text not null check (kind in ('expense', 'income', 'investment')),
  category_id    uuid references public.ft_categories (id) on delete set null,
  amount         numeric(14, 2) not null check (amount >= 0),
  every_n_months integer not null default 1 check (every_n_months between 1 and 12),
  day_of_month   integer not null default 1 check (day_of_month between 1 and 28),
  anchor_month   date not null default date_trunc('month', now())::date,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------- settings
-- One row per user. Holds the Gemini key used for the AI analysis.
create table if not exists public.ft_settings (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  currency       text not null default 'INR',
  gemini_api_key text,
  monthly_budget numeric(14, 2),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------- row level security
-- Every table: a user can touch their own rows and nothing else.
do $$
declare
  t text;
begin
  for t in select unnest(array['ft_categories', 'ft_transactions', 'ft_recurring', 'ft_settings'])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows select" on public.%I', t);
    execute format('create policy "own rows select" on public.%I for select using ((select auth.uid()) = user_id)', t);
    execute format('drop policy if exists "own rows insert" on public.%I', t);
    execute format('create policy "own rows insert" on public.%I for insert with check ((select auth.uid()) = user_id)', t);
    execute format('drop policy if exists "own rows update" on public.%I', t);
    execute format('create policy "own rows update" on public.%I for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('drop policy if exists "own rows delete" on public.%I', t);
    execute format('create policy "own rows delete" on public.%I for delete using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- keep ft_settings.updated_at fresh
create or replace function public.ft_touch_updated_at()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ft_settings_touch on public.ft_settings;
create trigger ft_settings_touch before update on public.ft_settings
  for each row execute function public.ft_touch_updated_at();
