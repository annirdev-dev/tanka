-- Replaces the standalone Express server's in-memory station catalog,
-- price-history log, and route cache with durable Postgres tables, so the
-- backend can move to Supabase Edge Functions + Cron instead of a laptop
-- process behind a temporary tunnel.

create table public.stations (
  id text primary key,
  name text not null,
  brand text not null default '',
  street text not null default '',
  place text not null default '',
  municipality text not null default '',
  district text not null default '',
  post_code text,
  lat double precision not null,
  lng double precision not null,
  gasoline_95 numeric,
  gasoline_95_plus numeric,
  gasoline_98 numeric,
  gasoline_98_plus numeric,
  diesel numeric,
  diesel_plus numeric,
  gpl_auto numeric,
  updated_at timestamptz not null default now()
);

create index stations_lat_idx on public.stations (lat);
create index stations_lng_idx on public.stations (lng);

alter table public.stations enable row level security;
create policy "stations are publicly readable" on public.stations
  for select using (true);

create table public.price_history (
  id bigint generated always as identity primary key,
  station_id text not null references public.stations (id) on delete cascade,
  fuel_type text not null,
  price numeric not null,
  recorded_at timestamptz not null default now()
);

create index price_history_lookup_idx on public.price_history (station_id, fuel_type, recorded_at desc);

alter table public.price_history enable row level security;
create policy "price history is publicly readable" on public.price_history
  for select using (true);

create table public.route_cache (
  cache_key text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Haversine distance in km, computed directly in SQL — mirrors the
-- application-level haversine the old server used, so behaviour is
-- unchanged, just moved server-side into Postgres.
create or replace function public.nearby_stations(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision,
  p_fuel text default 'all'
)
returns table (
  id text, name text, brand text, street text, place text, municipality text,
  district text, post_code text, lat double precision, lng double precision,
  gasoline_95 numeric, gasoline_95_plus numeric, gasoline_98 numeric, gasoline_98_plus numeric,
  diesel numeric, diesel_plus numeric, gpl_auto numeric, updated_at timestamptz, dist_km double precision
)
language sql stable as $$
  select
    s.id, s.name, s.brand, s.street, s.place, s.municipality, s.district, s.post_code,
    s.lat, s.lng, s.gasoline_95, s.gasoline_95_plus, s.gasoline_98, s.gasoline_98_plus,
    s.diesel, s.diesel_plus, s.gpl_auto, s.updated_at,
    2 * 6371 * asin(sqrt(
      sin(radians(s.lat - p_lat) / 2) ^ 2 +
      cos(radians(p_lat)) * cos(radians(s.lat)) * sin(radians(s.lng - p_lng) / 2) ^ 2
    )) as dist_km
  from public.stations s
  where (
    p_fuel = 'all' or (
      case p_fuel
        when 'gasoline_95' then s.gasoline_95
        when 'gasoline_95_plus' then s.gasoline_95_plus
        when 'gasoline_98' then s.gasoline_98
        when 'gasoline_98_plus' then s.gasoline_98_plus
        when 'diesel' then s.diesel
        when 'diesel_plus' then s.diesel_plus
        when 'gpl_auto' then s.gpl_auto
      end
    ) is not null
  )
  and 2 * 6371 * asin(sqrt(
    sin(radians(s.lat - p_lat) / 2) ^ 2 +
    cos(radians(p_lat)) * cos(radians(s.lat)) * sin(radians(s.lng - p_lng) / 2) ^ 2
  )) <= p_radius_km;
$$;

-- Latest-vs-previous price delta per (station, fuel) — mirrors the old
-- historyStore.getTrend logic: needs at least two recorded snapshots.
create or replace function public.stations_trends(p_station_ids text[])
returns table (station_id text, fuel_type text, delta numeric, direction text)
language sql stable as $$
  with ranked as (
    select station_id, fuel_type, price,
      row_number() over (partition by station_id, fuel_type order by recorded_at desc) as rn
    from public.price_history
    where station_id = any(p_station_ids)
  )
  select
    a.station_id, a.fuel_type,
    round(a.price - b.price, 3) as delta,
    case when a.price > b.price then 'up' when a.price < b.price then 'down' else 'flat' end as direction
  from ranked a
  join ranked b on a.station_id = b.station_id and a.fuel_type = b.fuel_type and b.rn = 2
  where a.rn = 1;
$$;
