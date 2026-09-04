alter table public.ld_github_installations
  add column if not exists selected_repositories jsonb;

alter table public.ld_supabase_connections
  add column if not exists selected_projects jsonb;

comment on column public.ld_github_installations.selected_repositories is
  'Nullable JSON array of GitHub repository full names enabled for Lovable Decrypter. NULL means all currently authorized repositories are enabled.';

comment on column public.ld_supabase_connections.selected_projects is
  'Nullable JSON array of Supabase project refs enabled for Lovable Decrypter. NULL means all currently OAuth-visible projects are enabled.';
