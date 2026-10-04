-- Found in the 2026-10-03 pre-launch review:
--  * the app's "Delete account" button called delete_own_account(), which was
--    never created — it silently did nothing but sign the user out;
--  * any signed-in user could rewrite their own trial_started_at (RLS only
--    checks row ownership), so the 5-day trial could be reset or extended;
--  * deleting and re-creating an account handed out a brand-new trial.

-- 1. Trials already used, remembered per sign-in identity (Apple / Google
--    account), not per account, so they outlive a deleted account. Only the
--    hash of "provider:id" is stored. No policies on purpose: server-only.
create table if not exists public.trial_claims (
  identity_hash text primary key,
  trial_started_at bigint not null,
  created_at timestamptz not null default now()
);
alter table public.trial_claims enable row level security;

-- 2. The caller's own remembered trial start, if any of their identities
--    already used one. Returns only the caller's own data (auth.uid()).
create or replace function public.trial_claim_for_me()
returns bigint
language sql
stable
security definer
set search_path = public, auth
as $$
  select min(c.trial_started_at)
  from auth.identities i
  join public.trial_claims c
    on c.identity_hash = encode(sha256(convert_to(i.provider || ':' || i.provider_id, 'utf8')), 'hex')
  where i.user_id = auth.uid();
$$;
revoke all on function public.trial_claim_for_me() from public, anon;
grant execute on function public.trial_claim_for_me() to authenticated;

-- 3. The trial start is decided by the server. Client calls (role
--    authenticated/anon) can no longer choose or change it: a new row gets
--    the remembered start for that identity, or "now"; an existing value is
--    kept. The dashboard (postgres), service_role and the security-definer
--    function below are not affected.
create or replace function public.protect_trial()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.trial_started_at := coalesce(
        public.trial_claim_for_me(),
        (extract(epoch from now()) * 1000)::bigint
      );
    else
      new.trial_started_at := coalesce(
        old.trial_started_at,
        public.trial_claim_for_me(),
        (extract(epoch from now()) * 1000)::bigint
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists user_data_protect_trial on public.user_data;
create trigger user_data_protect_trial
  before insert or update on public.user_data
  for each row execute function public.protect_trial();

-- 4. Real account deletion. Remembers the trial the identities already used,
--    then deletes the auth user, which cascades to user_data (favorites,
--    alerts, push token, trial/Pro record).
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  started bigint;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  select trial_started_at into started from public.user_data where user_id = uid;
  if started is not null then
    insert into public.trial_claims (identity_hash, trial_started_at)
    select encode(sha256(convert_to(i.provider || ':' || i.provider_id, 'utf8')), 'hex'), started
    from auth.identities i
    where i.user_id = uid
    on conflict (identity_hash) do update
      set trial_started_at = least(public.trial_claims.trial_started_at, excluded.trial_started_at);
  end if;

  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

-- 5. Test builds only: lets allow-listed accounts move their own trial start
--    (the "End trial now" / "Restart trial" buttons in the TestFlight build).
--    The table starts empty, so for everyone else the function just refuses.
create table if not exists public.test_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.test_accounts enable row level security;

create or replace function public.test_set_trial_start(p_days_ago integer)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  started bigint;
begin
  if not exists (select 1 from public.test_accounts where user_id = auth.uid()) then
    raise exception 'This account is not a test account';
  end if;
  started := (extract(epoch from now()) * 1000)::bigint - p_days_ago::bigint * 86400000;
  update public.user_data set trial_started_at = started where user_id = auth.uid();
  return started;
end;
$$;
revoke all on function public.test_set_trial_start(integer) from public, anon;
grant execute on function public.test_set_trial_start(integer) to authenticated;

-- Today every account in this project is one of the developer's own test
-- accounts, so allow-list them all once. Do NOT re-run this line after real
-- users exist.
insert into public.test_accounts (user_id)
select id from auth.users
on conflict do nothing;
