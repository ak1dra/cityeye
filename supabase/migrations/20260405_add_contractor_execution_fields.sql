alter table public.reports
add column if not exists contractor_org_name text,
add column if not exists operator_org_name text,
add column if not exists asset_type text,
add column if not exists asset_owner text,
add column if not exists service_zone text,
add column if not exists warranty_until timestamptz,
add column if not exists responsibility_mode text check (
  responsibility_mode in ('warranty_contractor', 'operator', 'government', 'shared', 'disputed')
),
add column if not exists work_order_status text check (
  work_order_status in ('assigned', 'accepted', 'blocked', 'disputed', 'completed', 'verified')
),
add column if not exists sla_due_at timestamptz,
add column if not exists proof_status text check (
  proof_status in ('not_required', 'required', 'uploaded', 'verified')
),
add column if not exists verification_score integer check (
  verification_score between 0 and 100
);
