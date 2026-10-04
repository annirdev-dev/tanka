-- Security hardening found during a pre-launch review (2026-09-26).

-- route_cache was created without RLS — it's an internal cache the client
-- never reads directly (only the `route` Edge Function does, via the
-- service-role key, which bypasses RLS anyway), so locking it down entirely
-- costs nothing functionally and closes an open public read/write/delete hole.
alter table public.route_cache enable row level security;

-- has_pro must only ever be set by a trusted server-side process. Until now
-- the client's own upsert to user_data could set has_pro = true with zero
-- purchase at all, since the existing RLS policies only check row ownership,
-- not which columns change. This trigger discards any has_pro change that
-- doesn't come from the service_role, regardless of which endpoint or tool a
-- client uses to attempt it.
create or replace function public.protect_has_pro()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if tg_op = 'INSERT' then
      new.has_pro := false;
    else
      new.has_pro := old.has_pro;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists user_data_protect_has_pro on public.user_data;
create trigger user_data_protect_has_pro
  before insert or update on public.user_data
  for each row execute function public.protect_has_pro();
