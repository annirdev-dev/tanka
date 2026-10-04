-- Refund handling: remember which Apple purchase gave an account Pro, so that
-- when Apple says that purchase was refunded the matching accounts can lose it
-- (see supabase/functions/apple-notifications).
alter table public.user_data
  add column if not exists apple_original_transaction_id text;

create index if not exists user_data_apple_original_transaction_id_idx
  on public.user_data (apple_original_transaction_id);

-- Like has_pro, this column may only be written by the server (service_role):
-- otherwise a signed-in user could point their row at someone else's purchase.
-- (Replaces the protect_has_pro trigger function from
-- 20260926120000_security_hardening.sql; the trigger itself stays.)
create or replace function public.protect_has_pro()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    if tg_op = 'INSERT' then
      new.has_pro := false;
      new.apple_original_transaction_id := null;
    else
      new.has_pro := old.has_pro;
      new.apple_original_transaction_id := old.apple_original_transaction_id;
    end if;
  end if;
  return new;
end;
$$;
