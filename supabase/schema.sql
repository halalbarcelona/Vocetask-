-- Run this in the Supabase SQL editor (Project → SQL Editor → New query) once, after project creation.
--
-- This backend has exactly one job: hold a server-verified premium flag per
-- account email, so the Stripe payment actually means something (rather than
-- the old client-side-only "aura-premium" flag anyone could flip in devtools).
-- Accounts and tasks stay fully local (localStorage) — this table is not a
-- users/profiles table and nothing else is synced.

create table if not exists premium_status (
  email text primary key,
  is_premium boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table premium_status enable row level security;

-- Anyone can read their own premium status by email (no auth session exists
-- to scope this further — the app has no login). There is deliberately no
-- insert/update/delete policy: the anon key can never write to this table.
-- Only the stripe-webhook Edge Function (using the service_role key, which
-- bypasses RLS entirely) can write.
create policy "premium_status: read all" on premium_status for select using (true);
