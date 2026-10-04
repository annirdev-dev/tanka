-- Abuse limits found in the 2026-10-04 pre-submission audit.

-- 1. Per-user daily counter for route lookups that actually cost money (the
--    ones not served from route_cache). Server-only: no policies, and only the
--    service role may call the counting function.
create table if not exists public.route_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day)
);
alter table public.route_usage enable row level security;

create or replace function public.increment_route_usage(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
begin
  -- Keep the table tiny: only the last week matters.
  delete from public.route_usage where day < ((now() at time zone 'utc')::date - 7);

  insert into public.route_usage (user_id, day, count)
  values (p_user_id, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set count = public.route_usage.count + 1
  returning public.route_usage.count into used;

  return used;
end;
$$;
revoke all on function public.increment_route_usage(uuid) from public, anon, authenticated;
grant execute on function public.increment_route_usage(uuid) to service_role;

-- 2. A signed-in user can write their own user_data row, so cap how much they
--    can store in it (favorites/alerts are tiny in real use).
alter table public.user_data drop constraint if exists user_data_json_size;
alter table public.user_data add constraint user_data_json_size check (
  pg_column_size(favorites) <= 262144
  and pg_column_size(alarms) <= 131072
  and coalesce(length(push_token), 0) <= 200
);
