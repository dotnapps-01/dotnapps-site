/**
 * Schema migrations, applied in order on first connection and recorded in schema_migrations.
 * Append new entries; never edit one that has shipped.
 * Plain SQL that runs on both Postgres and PGlite.
 */
export const migrations: { id: string; sql: string }[] = [
  {
    id: "001_core",
    sql: `
create table users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  created_at timestamptz not null default now()
);

-- One workspace per owner for now (workspace -> locations -> QR codes -> scans).
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references users(id) on delete cascade,
  name text not null default '',
  industry text not null default '',
  goals text[] not null default '{}',
  plan text not null default 'free' check (plan in ('free','starter','growth','business','enterprise')),
  step int not null default 1,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  address text not null default '',
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index locations_workspace_idx on locations(workspace_id);
create unique index locations_one_primary on locations(workspace_id) where is_primary;

create table folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table qr_codes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  folder_id uuid references folders(id) on delete set null,
  name text not null,
  type text not null,
  dynamic boolean not null default true,
  short_code text unique,
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  config jsonb not null default '{}',
  design jsonb not null default '{}',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (dynamic or short_code is null)
);
create index qr_codes_workspace_idx on qr_codes(workspace_id, status);

-- One row per human scan. visitor is a keyed hash, never a raw IP or user agent.
create table scans (
  id bigserial primary key,
  qr_id uuid not null references qr_codes(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  visitor text not null,
  city text,
  device text not null default 'other',
  lang text not null default 'other'
);
create index scans_workspace_time_idx on scans(workspace_id, scanned_at);
create index scans_qr_time_idx on scans(qr_id, scanned_at);

-- OTP limits (shared across server instances)
create table otp_attempts (
  challenge_id text primary key,
  attempts int not null default 0,
  used boolean not null default false,
  expires_at timestamptz not null
);
create table otp_sends (
  phone text not null,
  sent_at timestamptz not null default now()
);
create index otp_sends_phone_idx on otp_sends(phone, sent_at);
`,
  },
];
