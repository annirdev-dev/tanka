-- Android purchases: remember which Google Play purchase gave an account Pro,
-- so that when Google says it was refunded (google-refunds, hourly) the
-- matching accounts can lose it. Mirrors apple_original_transaction_id.
alter table public.user_data
  add column if not exists google_purchase_token text;

create index if not exists user_data_google_purchase_token_idx
  on public.user_data (google_purchase_token);

-- Like has_pro and apple_original_transaction_id, this column may only be
-- written by the server (service_role): otherwise a signed-in user could point
-- their row at someone else's purchase. (Replaces the protect_has_pro trigger
-- function from 20261003150000_apple_refunds.sql; the trigger itself stays.)
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
      new.google_purchase_token := null;
    else
      new.has_pro := old.has_pro;
      new.apple_original_transaction_id := old.apple_original_transaction_id;
      new.google_purchase_token := old.google_purchase_token;
    end if;
  end if;
  return new;
end;
$$;

-- Hourly refund check. Uses the same Vault secret as the other jobs
-- (see 20260922190000_schedule_backend_jobs.sql).
select cron.schedule(
  'google-refunds', '27 * * * *',
  $$ select net.http_post(
    url := 'https://ztmjaguxrjkqyueheanw.supabase.co/functions/v1/google-refunds',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_service_role_key'))
  ) $$
);
