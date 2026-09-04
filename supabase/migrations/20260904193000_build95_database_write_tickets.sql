create table if not exists public.ld_database_write_tickets (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.ld_license_keys(id) on delete cascade,
  device_hash text not null,
  project_ref text not null check (project_ref ~ '^[A-Za-z0-9]{8,32}$'),
  sql_hash text not null check (length(sql_hash) = 64),
  risk text not null check (risk in ('SAFE','CAUTION','DESTRUCTIVE')),
  statement_summary jsonb not null default '{}'::jsonb,
  status text not null default 'prepared' check (status in ('prepared','approved','running','applied','verification_required','rejected','expired')),
  recovery_evidence text,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null,
  result_summary jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ld_database_write_tickets_owner_idx
  on public.ld_database_write_tickets(license_id, device_hash, created_at desc);
create index if not exists ld_database_write_tickets_expiry_idx
  on public.ld_database_write_tickets(expires_at);
create index if not exists ld_database_write_tickets_status_idx
  on public.ld_database_write_tickets(status, expires_at);

alter table public.ld_database_write_tickets enable row level security;
revoke all on table public.ld_database_write_tickets from public, anon, authenticated;
grant all on table public.ld_database_write_tickets to service_role;

comment on table public.ld_database_write_tickets is
  'Build95 server-side one-time approval tickets. SQL text is never persisted; only its SHA-256 binding is stored.';
