-- Invitations table — tracks platform invitations sent from admin panel
-- with email open tracking and registration status.

create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  name        text,                          -- optional recipient name
  sent_at     timestamptz not null default now(),
  opened_at   timestamptz,                   -- first open timestamp
  opened_count int not null default 0,       -- total open count
  clicked_at  timestamptz,                   -- first CTA click (via redirect)
  registered_at timestamptz,                 -- when user actually registered
  status      text not null default 'sent'   -- sent | opened | registered
    check (status in ('sent', 'opened', 'registered')),
  sent_by     uuid references auth.users(id), -- admin who sent it
  resend_id   text,                          -- Resend email id for debugging
  notes       text,                          -- optional admin notes
  created_at  timestamptz not null default now()
);

-- Index for admin listing (newest first) and duplicate check
create index if not exists idx_invitations_email on public.invitations (email);
create index if not exists idx_invitations_sent_at on public.invitations (sent_at desc);

-- RLS: only admins can read/write
alter table public.invitations enable row level security;

create policy "Admin full access to invitations"
  on public.invitations
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'super_admin'
    )
  );

-- Allow service_role (API routes) full access automatically (bypasses RLS)
