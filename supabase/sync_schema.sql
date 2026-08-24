-- Run this in the Supabase SQL editor (Project → SQL Editor → New query) once,
-- to turn on cross-device task sync. Until this runs, the Sync feature in the
-- app safely no-ops (see src/hooks/useSync.js / useTasks.js) — nothing here is
-- required for the rest of the app to work.
--
-- This adds real authentication (email one-time-code sign-in) and a tasks
-- table scoped to the signed-in user, on top of the existing premium_status
-- backend. Signing in and syncing is entirely opt-in from Settings; an
-- account that never opts in keeps working exactly as it does today, fully
-- local, with no auth of any kind.

create table if not exists tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  date text not null default '',
  time text not null default '',
  category text not null default 'Personal',
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  order_key double precision not null default 1440,
  recurrence text not null default 'none',
  recurrence_days int[] not null default '{}',
  completed_dates text[] not null default '{}',
  subtasks jsonb not null default '[]',
  priority text not null default 'none',
  notes text not null default '',
  reminder_lead_minutes int not null default 0,
  labels text[] not null default '{}',
  section text not null default '',
  duration_minutes int not null default 0
);

create index if not exists tasks_user_id_idx on tasks (user_id);

-- updated_at is set by the server on every write, never trusted from the
-- client — that's what makes "which version is newer" a safe comparison
-- during merge instead of relying on a client's possibly-wrong clock.
create or replace function set_tasks_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at
  before insert or update on tasks
  for each row execute function set_tasks_updated_at();

alter table tasks enable row level security;

-- Owner-only, in every direction. A signed-in user can only ever see or
-- touch their own rows — there is no cross-account read of any kind.
create policy "tasks: owner select" on tasks for select using (auth.uid() = user_id);
create policy "tasks: owner insert" on tasks for insert with check (auth.uid() = user_id);
create policy "tasks: owner update" on tasks for update using (auth.uid() = user_id);
create policy "tasks: owner delete" on tasks for delete using (auth.uid() = user_id);

-- Email one-time-code sign-in needs no extra setup beyond this — Supabase's
-- built-in email provider is on by default for a new project and sends the
-- code itself. If it was ever disabled: Authentication → Providers → Email
-- in the Supabase dashboard, "Enable Email provider" on, "Confirm email" can
-- stay on (Aura Task's sign-in flow is code-based, not link-based, so it
-- isn't affected either way).
