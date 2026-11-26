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
  {
    id: "002_reviews",
    sql: `
-- Rating page settings, one row per workspace (defaults apply until saved).
create table review_settings (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  question text not null default 'How was your visit today?',
  chips text[] not null default '{Food,Service,Ambience,Price,Staff}',
  languages text[] not null default '{en,ta,hi}',
  manager_phone text not null default '',
  suggest_text boolean not null default true,
  links jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- One row per rating given on a rating page.
create table review_responses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  qr_id uuid references qr_codes(id) on delete set null,
  location_id uuid references locations(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  chips text[] not null default '{}',
  lang text not null default 'en',
  source text not null default '',
  staff text not null default '',
  visitor text not null,
  google_clicked boolean not null default false,
  created_at timestamptz not null default now()
);
create index review_responses_ws_time_idx on review_responses(workspace_id, created_at);
create index review_responses_visitor_idx on review_responses(visitor, created_at);

-- Private feedback: an extra channel next to Google, never a filter.
create table feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  response_id uuid unique references review_responses(id) on delete set null,
  qr_id uuid references qr_codes(id) on delete set null,
  message text not null,
  phone text not null default '',
  chips text[] not null default '{}',
  status text not null default 'open' check (status in ('open','in_progress','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index feedback_ws_status_idx on feedback(workspace_id, status, created_at);
`,
  },
  {
    id: "003_engage",
    sql: `
-- People who interacted with a QR code and gave their number.
create table contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  source text not null default '',
  tags text[] not null default '{}',
  opt_in boolean not null default false,
  visits int not null default 1,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index contacts_ws_phone_idx on contacts(workspace_id, phone) where phone <> '';
create index contacts_ws_idx on contacts(workspace_id, created_at desc);

-- Menus, business cards and link-in-bio pages (content is a validated JSON document).
create table pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind text not null check (kind in ('menu','card','bio')),
  title text not null,
  content jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pages_ws_idx on pages(workspace_id, kind);

create table lead_forms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  intro text not null default '',
  fields text[] not null default '{}',
  interests text[] not null default '{}',
  submit_label text not null default 'Request a callback',
  notify_phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lead_forms_ws_idx on lead_forms(workspace_id);

create table leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  form_id uuid references lead_forms(id) on delete set null,
  qr_id uuid references qr_codes(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  name text not null,
  phone text not null,
  email text not null default '',
  interest text not null default '',
  preferred_time text not null default '',
  message text not null default '',
  source text not null default '',
  stage text not null default 'new' check (stage in ('new','contacted','qualified','won','lost')),
  owner text not null default '',
  notes text not null default '',
  visitor text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_ws_stage_idx on leads(workspace_id, stage, created_at desc);
create index leads_visitor_idx on leads(visitor, created_at);

create table coupons (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  headline text not null,
  description text not null default '',
  code_prefix text not null default 'SKN',
  valid_days int not null default 7 check (valid_days between 1 and 365),
  starts_at timestamptz,
  ends_at timestamptz,
  total_limit int check (total_limit is null or total_limit > 0),
  per_customer int not null default 1 check (per_customer between 1 and 20),
  status text not null default 'active' check (status in ('active','paused')),
  created_at timestamptz not null default now()
);
create index coupons_ws_idx on coupons(workspace_id);

create table coupon_claims (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references coupons(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  qr_id uuid references qr_codes(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  phone text not null,
  code text not null unique,
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by text not null default '',
  visitor text not null default ''
);
create index coupon_claims_coupon_idx on coupon_claims(coupon_id, phone);
create index coupon_claims_visitor_idx on coupon_claims(visitor, claimed_at);

-- One loyalty programme per workspace.
create table loyalty_programs (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  name text not null default 'Loyalty card',
  stamps_needed int not null default 10 check (stamps_needed between 2 and 30),
  reward text not null default '1 free item',
  pin_hash text not null default '',
  expires_months int check (expires_months is null or expires_months between 1 and 60),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table loyalty_cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  qr_id uuid references qr_codes(id) on delete set null,
  phone text not null,
  name text not null default '',
  stamps int not null default 0,
  rewards_earned int not null default 0,
  last_stamp_at timestamptz,
  pin_failures int not null default 0,
  pin_locked_until timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, phone)
);

create table loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references loyalty_cards(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  code text not null unique,
  earned_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by text not null default ''
);

create table loyalty_stamps (
  id bigserial primary key,
  card_id uuid not null references loyalty_cards(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  qr_id uuid references qr_codes(id) on delete set null,
  at timestamptz not null default now()
);
create index loyalty_stamps_ws_idx on loyalty_stamps(workspace_id, at);

-- Shared throttle for public endpoints (lead forms, coupon claims, loyalty sign-ups).
create table public_hits (
  visitor text not null,
  kind text not null,
  at timestamptz not null default now()
);
create index public_hits_idx on public_hits(visitor, kind, at);
`,
  },
];
