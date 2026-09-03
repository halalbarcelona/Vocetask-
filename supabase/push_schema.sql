-- This is now live on the production project (ogrhsphixhgkbpdlzfks): the
-- tables, the get_vault_secret() RPC, and the once-a-minute cron job below
-- have all been applied and verified end-to-end (401 without the shared
-- secret, 200 with it). Kept here as the record of what's deployed and to
-- reproduce it on a fresh project — it is no longer a to-do list.
--
-- Real push needs a server to decide "it's time," since a closed browser tab
-- runs no JavaScript at all. That's what this migration + a scheduled
-- Edge Function provide. It only ever applies to a signed-in Sync account —
-- there's no server to push to for a fully local, never-synced user.

-- One row per browser/device push subscription. RLS-scoped exactly like the
-- tasks table: a signed-in user can only ever see or touch their own rows.
create table if not exists push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  -- IANA timezone name (e.g. "Asia/Kolkata"), captured from the browser at
  -- subscribe time. The server has no other way to know what "9am" means
  -- for this particular person — Postgres has no access to a phone's clock.
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

create policy "push_subscriptions: owner select" on push_subscriptions for select using (auth.uid() = user_id);
create policy "push_subscriptions: owner insert" on push_subscriptions for insert with check (auth.uid() = user_id);
create policy "push_subscriptions: owner update" on push_subscriptions for update using (auth.uid() = user_id);
create policy "push_subscriptions: owner delete" on push_subscriptions for delete using (auth.uid() = user_id);

-- One row per reminder actually sent, keyed by the specific day it fired
-- for — a daily recurring task needs a fresh entry every day, not one row
-- for its whole lifetime. This is what stops the once-a-minute cron job
-- from sending the same reminder twice if it (or the network) ever retries.
-- Written only by the Edge Function's service_role client — RLS is on with
-- no policies at all, so no signed-in user's anon-key session can read or
-- write it either, same lockout pattern as premium_status's write side.
create table if not exists reminder_log (
  task_id text not null,
  occurrence_date text not null,
  sent_at timestamptz not null default now(),
  primary key (task_id, occurrence_date)
);

alter table reminder_log enable row level security;

-- ---------------------------------------------------------------------------
-- Vault access: the `vault` schema is deliberately NOT exposed over
-- PostgREST (same boundary that keeps the raw service_role key out of
-- reach) — so the Edge Function's supabase-js client cannot query
-- vault.decrypted_secrets directly; that call 500s. The sanctioned way
-- through is a SECURITY DEFINER function in `public`, executable only by
-- service_role, that reads Vault on the function's behalf.
create or replace function public.get_vault_secret(secret_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_value text;
begin
  select decrypted_secret into secret_value
  from vault.decrypted_secrets
  where name = secret_name;
  return secret_value;
end;
$$;

revoke all on function public.get_vault_secret(text) from public, anon, authenticated;
grant execute on function public.get_vault_secret(text) to service_role;

-- ---------------------------------------------------------------------------
-- Scheduling: pg_cron calls the Edge Function once a minute via pg_net.
--
-- The function is deployed with --no-verify-jwt (verify_jwt: false) because
-- pg_cron/pg_net has no Supabase user session to hand it a JWT. In its
-- place, the function checks an X-Cron-Secret header against a random
-- secret that only this project's database and this function ever see —
-- generated once with `openssl rand -hex 32`, never the service_role key.
--
-- One-time setup, run in the SQL editor:
--
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--
--   select vault.create_secret('<vapid public key>', 'vapid_public_key');
--   select vault.create_secret('<vapid private key>', 'vapid_private_key');
--   select vault.create_secret('<openssl rand -hex 32 output>', 'cron_shared_secret');
--
--   select cron.schedule(
--     'send-reminders-every-minute',
--     '* * * * *',
--     $cron$
--     select net.http_post(
--       url := 'https://ogrhsphixhgkbpdlzfks.supabase.co/functions/v1/send-reminders',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'X-Cron-Secret', (
--           select decrypted_secret from vault.decrypted_secrets
--           where name = 'cron_shared_secret'
--         )
--       ),
--       body := '{}'::jsonb
--     );
--     $cron$
--   );
--
-- To stop it later: select cron.unschedule('send-reminders-every-minute');
--
-- Verified live: an unauthenticated request to the function returns 401;
-- one carrying the correct X-Cron-Secret returns 200 with {"sent": N}.
