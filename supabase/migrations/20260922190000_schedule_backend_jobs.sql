-- Schedules the background jobs that used to be setInterval() loops in the
-- standalone Node server. Each sync-stations call is scoped to one fuel type
-- and staggered 3 minutes apart (worst case a single fuel's sync takes ~40s),
-- so no two invocations overlap. Matches the old 6h catalog sync / 15m
-- price-alert check cadence.
--
-- The service role key these jobs authenticate with is stored in Supabase
-- Vault (see supabase.com/docs/guides/database/vault) under the name
-- 'cron_service_role_key' — ALTER DATABASE ... SET isn't permitted on a
-- hosted Supabase project, so a plain custom GUC isn't an option here.
-- Run once, from the project owner's own terminal (never through an agent):
--   select vault.create_secret('<service-role-key>', 'cron_service_role_key');

select cron.schedule(
  'sync-gasoline-95', '0 */6 * * *',
  $$ select net.http_post(
    url := 'https://ztmjaguxrjkqyueheanw.supabase.co/functions/v1/sync-stations?fuel=gasoline_95',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_service_role_key'))
  ) $$
);

select cron.schedule(
  'sync-gasoline-95-plus', '3 */6 * * *',
  $$ select net.http_post(
    url := 'https://ztmjaguxrjkqyueheanw.supabase.co/functions/v1/sync-stations?fuel=gasoline_95_plus',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_service_role_key'))
  ) $$
);

select cron.schedule(
  'sync-gasoline-98', '6 */6 * * *',
  $$ select net.http_post(
    url := 'https://ztmjaguxrjkqyueheanw.supabase.co/functions/v1/sync-stations?fuel=gasoline_98',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_service_role_key'))
  ) $$
);

select cron.schedule(
  'sync-gasoline-98-plus', '9 */6 * * *',
  $$ select net.http_post(
    url := 'https://ztmjaguxrjkqyueheanw.supabase.co/functions/v1/sync-stations?fuel=gasoline_98_plus',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_service_role_key'))
  ) $$
);

select cron.schedule(
  'sync-diesel', '12 */6 * * *',
  $$ select net.http_post(
    url := 'https://ztmjaguxrjkqyueheanw.supabase.co/functions/v1/sync-stations?fuel=diesel',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_service_role_key'))
  ) $$
);

select cron.schedule(
  'sync-diesel-plus', '15 */6 * * *',
  $$ select net.http_post(
    url := 'https://ztmjaguxrjkqyueheanw.supabase.co/functions/v1/sync-stations?fuel=diesel_plus',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_service_role_key'))
  ) $$
);

select cron.schedule(
  'sync-gpl-auto', '18 */6 * * *',
  $$ select net.http_post(
    url := 'https://ztmjaguxrjkqyueheanw.supabase.co/functions/v1/sync-stations?fuel=gpl_auto',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_service_role_key'))
  ) $$
);

select cron.schedule(
  'push-alerts', '*/15 * * * *',
  $$ select net.http_post(
    url := 'https://ztmjaguxrjkqyueheanw.supabase.co/functions/v1/push-alerts',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_service_role_key'))
  ) $$
);
