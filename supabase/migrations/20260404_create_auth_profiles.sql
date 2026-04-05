create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('citizen', 'business', 'government')),
  status text not null default 'active' check (status in ('active', 'pending_approval', 'disabled')),
  full_name text,
  avatar_url text,
  organization_name text,
  position text,
  district text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gov_allowlist (
  email text primary key,
  full_name text not null,
  position text,
  district text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.touch_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch_updated_at on public.profiles;
create trigger trg_profiles_touch_updated_at
before update on public.profiles
for each row
execute function public.touch_profile_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.check_gov_allowlist(candidate_email text)
returns table (
  email text,
  full_name text,
  position text,
  district text,
  active boolean
)
language sql
security definer
set search_path = public
as $$
  select
    ga.email,
    ga.full_name,
    ga.position,
    ga.district,
    ga.active
  from public.gov_allowlist ga
  where lower(ga.email) = lower(candidate_email)
    and ga.active = true
  limit 1;
$$;

grant execute on function public.check_gov_allowlist(text) to anon, authenticated;

alter table public.reports enable row level security;

drop policy if exists "Public can read reports" on public.reports;
create policy "Public can read reports"
on public.reports
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can create reports" on public.reports;
create policy "Authenticated users can create reports"
on public.reports
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status in ('active', 'pending_approval')
      and lower(p.email) = lower(public.reports.user_email)
      and p.role = public.reports.reporter_role
  )
);

drop policy if exists "Managed users can update reports" on public.reports;
create policy "Managed users can update reports"
on public.reports
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('government', 'business')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('government', 'business')
  )
);

insert into public.gov_allowlist (email, full_name, position, district, active)
values (
  'gov@cityeye.kz',
  'Ruslan Berdenov',
  'Заместитель акима Алматы',
  'Алматы қаласы',
  true
)
on conflict (email) do update
set
  full_name = excluded.full_name,
  position = excluded.position,
  district = excluded.district,
  active = excluded.active;
