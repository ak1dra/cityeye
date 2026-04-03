alter table if exists public.reports
add column if not exists detected_issue_title text;

alter table if exists public.reports
add column if not exists suggested_responsible_role text;

alter table if exists public.reports
add column if not exists confidence_label text;
