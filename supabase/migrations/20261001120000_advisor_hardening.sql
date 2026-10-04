-- Fixes for Supabase Security/Performance Advisor warnings found 2026-10-01.
-- Pure hardening/optimization — no behavior change for correctly-authenticated
-- callers. pg_net's "Extension in Public" warning is deliberately NOT
-- addressed here: it's non-relocatable (extrelocatable = false), and every
-- cron job (sync-stations x7, push-alerts) depends on it via net.http_post —
-- a DROP/CREATE to relocate it risks breaking the entire sync pipeline for a
-- cosmetic schema-placement warning, not an actual exploitable issue (calls
-- are already schema-qualified as net.*, not bare names resolved via a
-- polluted public search_path).

-- Function Search Path Mutable: pin search_path so none of these can be
-- tricked by a search_path manipulated earlier in the same session/role.
alter function public.is_user_pro set search_path = public;
alter function public.nearby_stations set search_path = public;
alter function public.protect_has_pro set search_path = public;
alter function public.stations_delayed_prices set search_path = public;
alter function public.stations_trends set search_path = public;

-- Auth RLS Initialization Plan: wrap auth.uid() in a scalar subquery so
-- Postgres evaluates it once per query instead of once per row.
alter policy "Users can view their own data" on public.user_data
  using ((select auth.uid()) = user_id);
alter policy "Users can insert their own data" on public.user_data
  with check ((select auth.uid()) = user_id);
alter policy "Users can update their own data" on public.user_data
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
