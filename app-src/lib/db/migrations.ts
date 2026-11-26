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
  {
    id: "004_operate",
    sql: `
alter table workspaces add column ticket_seq int not null default 0;
alter table workspaces add column asset_seq int not null default 0;
alter table workspaces add column worker_seq int not null default 0;

-- ---------- tickets & assets ----------
create table assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  seq int not null,
  name text not null,
  place text not null default '',
  location_id uuid references locations(id) on delete set null,
  vendor text not null default '',
  interval_days int check (interval_days is null or interval_days between 1 and 3650),
  last_service date,
  next_due date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id, seq)
);

create table asset_services (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  serviced_on date not null,
  by_name text not null default '',
  notes text not null default '',
  ticket_id uuid,
  created_at timestamptz not null default now()
);
create index asset_services_asset_idx on asset_services(asset_id, serviced_on);

create table sla_rules (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  priority text not null check (priority in ('high','normal','low')),
  hours int not null check (hours between 1 and 720),
  primary key (workspace_id, priority)
);

create table tickets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  seq int not null,
  title text not null,
  category text not null default 'Other',
  priority text not null default 'normal' check (priority in ('high','normal','low')),
  status text not null default 'open' check (status in ('open','in_progress','resolved')),
  source text not null default 'manual',
  qr_id uuid references qr_codes(id) on delete set null,
  asset_id uuid references assets(id) on delete set null,
  feedback_id uuid unique references feedback(id) on delete set null,
  place text not null default '',
  customer_name text not null default '',
  customer_phone text not null default '',
  details text not null default '',
  assignee text not null default '',
  token text not null unique,
  visitor text not null default '',
  due_at timestamptz not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, seq)
);
create index tickets_ws_status_idx on tickets(workspace_id, status, created_at);

create table ticket_events (
  id bigserial primary key,
  ticket_id uuid not null references tickets(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind text not null,
  text text not null,
  public boolean not null default false,
  created_at timestamptz not null default now()
);
create index ticket_events_ticket_idx on ticket_events(ticket_id, created_at);

-- ---------- attendance & visitors ----------
create table workers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  code text not null,
  kind text not null default 'staff' check (kind in ('staff','labour')),
  name text not null,
  phone text not null,
  role text not null default '',
  shift_start int not null default 540 check (shift_start between 0 and 1439),
  shift_end int not null default 1080 check (shift_end between 1 and 1440),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id, code)
);

create table attend_points (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  lat double precision,
  lng double precision,
  radius_m int not null default 100 check (radius_m between 20 and 5000),
  require_geo boolean not null default true,
  created_at timestamptz not null default now()
);

create table attend_settings (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  late_after_min int not null default 15 check (late_after_min between 0 and 240)
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete cascade,
  day date not null,
  point_id uuid references attend_points(id) on delete set null,
  qr_id uuid references qr_codes(id) on delete set null,
  in_at timestamptz not null,
  out_at timestamptz,
  in_dist int,
  out_dist int,
  in_verified boolean not null default false,
  late_min int not null default 0,
  unique (worker_id, day)
);
create index attendance_ws_day_idx on attendance(workspace_id, day);

create table visitors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  qr_id uuid references qr_codes(id) on delete set null,
  name text not null,
  phone text not null,
  purpose text not null default '',
  host text not null default '',
  status text not null default 'awaiting' check (status in ('awaiting','approved','declined','on_site','checked_out')),
  token text not null unique,
  visitor text not null default '',
  valid_until timestamptz,
  decided_at timestamptz,
  in_at timestamptz,
  out_at timestamptz,
  created_at timestamptz not null default now()
);
create index visitors_ws_idx on visitors(workspace_id, created_at);

-- ---------- bookings & events ----------
create table booking_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind text not null check (kind in ('service','event')),
  name text not null,
  description text not null default '',
  duration_min int check (duration_min is null or duration_min between 5 and 1440),
  price numeric(10,2) check (price is null or price >= 0),
  staff text[] not null default '{}',
  needs_approval boolean not null default false,
  capacity int check (capacity is null or capacity between 1 and 100000),
  starts_at timestamptz,
  venue text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index booking_items_ws_idx on booking_items(workspace_id, kind);

create table booking_hours (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  dow int not null check (dow between 0 and 6),
  open_min int not null check (open_min between 0 and 1439),
  close_min int not null check (close_min between 1 and 1440),
  closed boolean not null default false,
  primary key (workspace_id, dow)
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  item_id uuid not null references booking_items(id) on delete cascade,
  qr_id uuid references qr_codes(id) on delete set null,
  name text not null,
  phone text not null,
  staff text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  qty int not null default 1 check (qty between 1 and 20),
  status text not null default 'confirmed' check (status in ('pending','confirmed','completed','no_show','cancelled')),
  code text not null unique,
  token text not null unique,
  visitor text not null default '',
  checked_in_at timestamptz,
  created_at timestamptz not null default now()
);
create index bookings_ws_time_idx on bookings(workspace_id, starts_at);
create index bookings_item_idx on bookings(item_id, starts_at);

-- ---------- real estate ----------
create table re_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  approval text not null default '',
  columns int not null default 10 check (columns between 2 and 20),
  road_after int[] not null default '{}',
  brochure_url text not null default '',
  whatsapp text not null default '',
  created_at timestamptz not null default now()
);

create table plots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references re_projects(id) on delete cascade,
  number int not null check (number between 1 and 9999),
  size_sqft int check (size_sqft is null or size_sqft > 0),
  dims text not null default '',
  facing text not null default '',
  price_lakh numeric(10,2) check (price_lakh is null or price_lakh >= 0),
  approval text not null default '',
  corner boolean not null default false,
  status text not null default 'available' check (status in ('available','hold','booked','sold')),
  created_at timestamptz not null default now(),
  unique (project_id, number)
);

create table plot_enquiries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  plot_id uuid not null references plots(id) on delete cascade,
  qr_id uuid references qr_codes(id) on delete set null,
  name text not null,
  phone text not null,
  ask text not null,
  visit_on date,
  visit_slot text not null default '',
  lead_id uuid references leads(id) on delete set null,
  source text not null default 'PLOT QR',
  visitor text not null default '',
  created_at timestamptz not null default now()
);
create index plot_enquiries_ws_idx on plot_enquiries(workspace_id, created_at);
`,
  },
  {
    id: "005_platform",
    sql: `
alter table workspaces add column suspended boolean not null default false;
alter table workspaces add column gstin text not null default '';
alter table workspaces add column default_lang text not null default 'en' check (default_lang in ('en','ta','hi'));
alter table workspaces add column retention_months int default 24 check (retention_months is null or retention_months in (12, 24));
alter table workspaces add column purged_on date;
alter table workspaces add column batch_seq int not null default 0;

-- What happened in a workspace, and who did it (the owner, or a Skanor admin acting for them).
create table audit_log (
  id bigserial primary key,
  workspace_id uuid references workspaces(id) on delete cascade,
  actor text not null,
  action text not null,
  detail text not null default '',
  at timestamptz not null default now()
);
create index audit_log_ws_idx on audit_log(workspace_id, at desc);

-- Platform switches the admin console controls. A missing row means "on".
create table feature_flags (
  key text primary key,
  enabled boolean not null,
  updated_at timestamptz not null default now()
);

-- ---------- API & webhooks ----------
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  scope text not null check (scope in ('read','qr:write','all')),
  key_hash text not null unique,
  last4 text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index api_keys_ws_idx on api_keys(workspace_id);

create table webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  url text not null,
  events text[] not null,
  secret text not null,
  active boolean not null default true,
  failures int not null default 0,
  last_status int,
  last_at timestamptz,
  created_at timestamptz not null default now()
);
create index webhook_endpoints_ws_idx on webhook_endpoints(workspace_id);

create table webhook_deliveries (
  id bigserial primary key,
  endpoint_id uuid not null references webhook_endpoints(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  event text not null,
  event_id uuid not null,
  status int,
  ok boolean not null,
  error text not null default '',
  attempt int not null default 1,
  at timestamptz not null default now()
);
create index webhook_deliveries_ep_idx on webhook_deliveries(endpoint_id, at desc);
create index webhook_deliveries_at_idx on webhook_deliveries(at);

-- ---------- product QR, warranty, authenticity ----------
create table products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  model text not null default '',
  made_in text not null default '',
  warranty_months int not null default 12 check (warranty_months between 0 and 120),
  manual_url text not null default '',
  videos_url text not null default '',
  buy_url text not null default '',
  service_enabled boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table product_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  seq int not null,
  prefix text not null,
  first_no int not null,
  last_no int not null,
  qty int not null check (qty between 1 and 20000),
  warranty_months int not null,
  format text not null default 'csv' check (format in ('csv','a4','label')),
  status text not null default 'printing' check (status in ('printing','in_market')),
  created_at timestamptz not null default now(),
  unique (workspace_id, seq)
);
create index product_batches_ws_idx on product_batches(workspace_id, created_at desc);

create table product_codes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  batch_id uuid not null references product_batches(id) on delete cascade,
  serial text not null,
  token text not null unique,
  scan_count int not null default 0,
  first_scan_at timestamptz,
  first_city text,
  flagged boolean not null default false,
  unique (workspace_id, serial)
);
create index product_codes_batch_idx on product_codes(batch_id);

create table product_scans (
  id bigserial primary key,
  code_id uuid not null references product_codes(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  visitor text not null,
  city text,
  at timestamptz not null default now()
);
create index product_scans_code_idx on product_scans(code_id, at);
create index product_scans_ws_idx on product_scans(workspace_id, at);

create table warranty_regs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  code_id uuid not null unique references product_codes(id) on delete cascade,
  name text not null,
  phone text not null,
  bought_from text not null default '',
  invoice_no text not null default '',
  purchased_on date not null,
  valid_until date not null,
  status text not null default 'verified' check (status in ('verified','review','rejected')),
  note text not null default '',
  created_at timestamptz not null default now()
);
create index warranty_regs_ws_idx on warranty_regs(workspace_id, created_at desc);

create table counterfeit_alerts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  code_id uuid not null references product_codes(id) on delete cascade,
  kind text not null check (kind in ('many_devices','two_cities','double_registration','report')),
  reason text not null,
  status text not null default 'new' check (status in ('new','investigating','dismissed','confirmed')),
  created_at timestamptz not null default now()
);
create index counterfeit_alerts_ws_idx on counterfeit_alerts(workspace_id, status, created_at desc);
create unique index counterfeit_alerts_auto_idx on counterfeit_alerts(code_id, kind) where kind <> 'report';
`,
  },
];
