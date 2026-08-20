-- Run this in the Supabase SQL editor (Project → SQL Editor → New query) once, after project creation.

create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  email text,
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text not null default '',
  date date,
  time text,
  category text not null default 'Personal',
  done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table tasks enable row level security;

create policy "profiles: read own" on profiles for select using (auth.uid() = id);
create policy "profiles: update own" on profiles for update using (auth.uid() = id);
create policy "profiles: insert own" on profiles for insert with check (auth.uid() = id);

create policy "tasks: read own" on tasks for select using (auth.uid() = user_id);
create policy "tasks: insert own" on tasks for insert with check (auth.uid() = user_id);
create policy "tasks: update own" on tasks for update using (auth.uid() = user_id);
create policy "tasks: delete own" on tasks for delete using (auth.uid() = user_id);

-- Creates a profiles row automatically whenever a new user signs up (magic link).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
