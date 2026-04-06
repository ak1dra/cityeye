create index if not exists reports_created_at_desc_idx
  on public.reports (created_at desc);

create index if not exists reports_status_idx
  on public.reports (status);

create index if not exists reports_severity_idx
  on public.reports (severity);

create index if not exists reports_responsible_role_idx
  on public.reports (responsible_role);

create index if not exists reports_shared_case_idx
  on public.reports (shared_case);

create index if not exists reports_sla_due_at_idx
  on public.reports (sla_due_at);
