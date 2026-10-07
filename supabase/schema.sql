-- Job Tracker schema. Run once in Supabase → SQL Editor.

create table if not exists public.applications (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  data       jsonb       not null check (octet_length(data::text) < 262144),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Each user sees and changes only their own rows.
alter table public.applications enable row level security;

drop policy if exists "own applications" on public.applications;
create policy "own applications" on public.applications
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.applications from anon;
grant select, insert, update, delete on public.applications to authenticated;

-- Tiny function the keep-alive workflow calls so the free project never pauses.
create or replace function public.ping() returns integer
  language sql stable security invoker set search_path = ''
  as $$ select 1 $$;
grant execute on function public.ping() to anon;
