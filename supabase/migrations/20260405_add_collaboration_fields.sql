alter table if exists public.reports
add column if not exists reporter_role text,
add column if not exists reporter_org_name text,
add column if not exists responsible_role text,
add column if not exists assigned_org_name text,
add column if not exists shared_case boolean default false,
add column if not exists partner_comment text;
