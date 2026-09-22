-- One row per signed-in user: cross-device sync of favorites/alarms, the
-- Expo push token for server-side price-alert notifications, and the Pro
-- trial start timestamp (server is the source of truth so it can't be reset
-- by reinstalling the app).
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  favorites jsonb not null default '{}'::jsonb,
  alarms jsonb not null default '{}'::jsonb,
  push_token text,
  trial_started_at bigint,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "Users can view their own data"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "Users can insert their own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own data"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
