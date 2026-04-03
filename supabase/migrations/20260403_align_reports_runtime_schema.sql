alter table if exists public.reports
add column if not exists title text;

alter table if exists public.reports
add column if not exists description text;

alter table if exists public.reports
add column if not exists type text;

alter table if exists public.reports
add column if not exists category text;

alter table if exists public.reports
add column if not exists severity text;

alter table if exists public.reports
add column if not exists status text default 'new';

alter table if exists public.reports
add column if not exists address text;

alter table if exists public.reports
add column if not exists comment text;

alter table if exists public.reports
add column if not exists image text;

alter table if exists public.reports
add column if not exists image_url text;

alter table if exists public.reports
add column if not exists priority_score integer;

alter table if exists public.reports
add column if not exists ai_comment text;

alter table if exists public.reports
add column if not exists recommended_action text;

alter table if exists public.reports
add column if not exists estimated_fix_time text;

alter table if exists public.reports
add column if not exists responsible_dept text;

alter table if exists public.reports
add column if not exists risk_for text;

alter table if exists public.reports
add column if not exists duplicate_likely boolean default false;

alter table if exists public.reports
add column if not exists estimated_resolution_days integer;

alter table if exists public.reports
add column if not exists recommendations jsonb;

alter table if exists public.reports
add column if not exists lat double precision;

alter table if exists public.reports
add column if not exists lng double precision;

alter table if exists public.reports
add column if not exists user_email text;

alter table if exists public.reports
add column if not exists user_name text;

alter table if exists public.reports
add column if not exists updated_at timestamptz default now();
