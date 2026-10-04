-- Backend support for gating live prices behind Pro/trial: a server-verified
-- purchase flag (client-only IAP state is trivially bypassable), a helper to
-- compute Pro status in one place, and a function to look up historical
-- ("delayed") prices for free users.

alter table public.user_data add column has_pro boolean not null default false;

-- Single source of truth for "is this account currently Pro" — mirrors the
-- app's own trial-length constant (PurchaseContext.tsx TRIAL_DURATION_DAYS).
-- If that ever changes, update the "5 days" here too.
create or replace function public.is_user_pro(p_user_id uuid)
returns boolean
language sql stable as $$
  select coalesce(
    (
      select has_pro or (
        trial_started_at is not null
        and now() < to_timestamp(trial_started_at / 1000.0) + interval '5 days'
      )
      from public.user_data
      where user_id = p_user_id
    ),
    false
  );
$$;

-- Latest price recorded at or before `p_as_of`, per (station, fuel) — lets a
-- free/expired-trial caller see meaningfully old ("yesterday's") prices
-- instead of the live figure, without a second live query path to keep in
-- sync with nearby_stations.
create or replace function public.stations_delayed_prices(p_station_ids text[], p_as_of timestamptz)
returns table (station_id text, fuel_type text, price numeric)
language sql stable as $$
  select distinct on (station_id, fuel_type) station_id, fuel_type, price
  from public.price_history
  where station_id = any(p_station_ids) and recorded_at <= p_as_of
  order by station_id, fuel_type, recorded_at desc;
$$;
