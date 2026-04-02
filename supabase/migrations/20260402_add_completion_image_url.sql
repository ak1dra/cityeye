alter table if exists public.reports
add column if not exists completion_image_url text;

alter table if exists public.reports
add column if not exists partner_comment text;

alter table if exists public.reports
add column if not exists reporter_role text;

alter table if exists public.reports
add column if not exists reporter_org_name text;

alter table if exists public.reports
add column if not exists responsible_role text;

alter table if exists public.reports
add column if not exists assigned_org_name text;

alter table if exists public.reports
add column if not exists shared_case boolean default false;
