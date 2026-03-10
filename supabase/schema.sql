create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  login text not null unique,
  display_name text not null,
  avatar_url text,
  balance_cached numeric(18,2) not null default 5000,
  created_at timestamptz not null default now()
);

create table if not exists public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  amount numeric(18,2) not null,
  balance_after numeric(18,2) not null,
  ref_kind text not null,
  ref_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.game_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  kind text not null,
  title text not null,
  status text not null default 'active',
  sort_order int not null default 0,
  thumbnail_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.game_configs (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.game_catalog(id) on delete cascade,
  version int not null,
  rtp_target numeric(5,2),
  volatility text,
  min_bet numeric(18,2) not null,
  max_bet numeric(18,2) not null,
  config_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.slot_symbol_assets (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.game_catalog(id) on delete cascade,
  symbol_code text not null,
  image_url text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.game_catalog(id) on delete cascade,
  status text not null,
  bet_amount numeric(18,2) not null,
  result_amount numeric(18,2) not null default 0,
  seed_public text not null,
  seed_secret_hash text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create table if not exists public.bonus_buys (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.game_rounds(id) on delete cascade,
  price_multiplier numeric(18,2) not null,
  feature_key text not null,
  result_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.game_catalog enable row level security;
alter table public.game_configs enable row level security;
alter table public.slot_symbol_assets enable row level security;
alter table public.game_rounds enable row level security;
alter table public.bonus_buys enable row level security;

create policy if not exists "profiles_select_self" on public.profiles
for select using (auth.uid() = id);

create policy if not exists "profiles_update_self" on public.profiles
for update using (auth.uid() = id);

create policy if not exists "wallet_select_self" on public.wallet_ledger
for select using (auth.uid() = user_id);

create policy if not exists "rounds_select_self" on public.game_rounds
for select using (auth.uid() = user_id);

create policy if not exists "catalog_public_read" on public.game_catalog
for select using (true);

create policy if not exists "configs_public_read" on public.game_configs
for select using (true);

create policy if not exists "symbols_public_read" on public.slot_symbol_assets
for select using (true);

