-- Run this in the Supabase SQL editor (Project → SQL Editor → New query) once,
-- to turn on real Web Push notifications — reminders that arrive even when
-- Aura Task isn't open in any tab. Until this runs (and the send-reminders
-- Edge Function is deployed — see supabase/functions/send-reminders/), the
-- app's existing in-tab reminder keeps working exactly as it does today.
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
-- Scheduling: pg_cron calls the Edge Function once a minute via pg_net.
--
-- The Edge Function needs your service_role key both to pass Supabase's own
-- gateway JWT check and for its admin database access inside the function
-- (same key the stripe-webhook function already uses). That key must never
-- be written into a file that gets committed to this repo — store it in
-- Supabase Vault instead, which only your project's Postgres can decrypt.
--
-- One-time setup, run in the SQL editor:
--
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--
--   select vault.create_secret(
--     '<paste your service_role key here — Project Settings -> API>',
--     'send_reminders_service_role_key'
--   );
--
--   select cron.schedule(
--     'send-reminders-every-minute',
--     '* * * * *',
--     $cron$
--     select net.http_post(
--       url := 'https://ogrhsphixhgkbpdlzfks.supabase.co/functions/v1/send-reminders',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || (
--           select decrypted_secret from vault.decrypted_secrets
--           where name = 'send_reminders_service_role_key'
--         )
--       ),
--       body := '{}'::jsonb
--     );
--     $cron$
--   );
--
-- To stop it later: select cron.unschedule('send-reminders-every-minute');
