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

-- There is deliberately no insert/update/delete policy: the anon key can
-- never write to this table. Only the stripe-webhook Edge Function (using
-- the service_role key, which bypasses RLS entirely) can write.
--
-- No SELECT policy either — the table holds every paying customer's email,
-- so a blanket "read all" policy (the original version of this file) let
-- anyone with the public anon key dump the whole customer list via a raw
-- REST call, not just check the one email they claim to own. Instead, the
-- client asks a narrow yes/no question through this function, which never
-- lets a caller enumerate rows or see anyone else's status.
create or replace function public.check_premium_status(check_email text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce((select is_premium from public.premium_status where email = check_email), false);
$$;

revoke all on function public.check_premium_status(text) from public;
grant execute on function public.check_premium_status(text) to anon, authenticated;
