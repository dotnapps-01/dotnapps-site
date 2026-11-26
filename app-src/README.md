# Skanor app (Phase 1)

Next.js (App Router) + TypeScript + Tailwind 3.4. Design references live in `../design`, the brief in `../CLAUDE.md`.

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build && npm start
```

- `/styleguide` — design system, built from the real components
- `/`, `/features`, `/features/review-assistant`, `/industries`, `/pricing`, `/contact` — marketing site (Phase 2). Copy and sample data live in `lib/content/`, sections in `components/marketing/`
- `/signup`, `/login`, `/onboarding` — WhatsApp-OTP sign-up and the 5-step wizard (Phase 3); `/app/*` now requires a session
- `/app/studio`, `/app/library`, `/app/analytics`, `/app/dashboard` — QR Studio, QR Library, Analytics and Dashboard on real data (Phase 4); `/q/<code>` is the redirect service
- `/app/reviews` — Reviews & feedback (Phase 5); customers reach `/r/<code>` from a Review QR (`/r/demo` is a public demo, `/r/preview` previews your own settings)
- `/app/pages`, `/app/leads`, `/app/offers` — Pages (menu, business card, link-in-bio), Leads & contacts, Offers & loyalty (Phase 6); customers reach `/s/<code>` from the matching QR type
- `/app/tickets`, `/app/attendance`, `/app/bookings`, `/app/real-estate` — Tickets & assets, Attendance & visitors, Bookings & events, Real estate plots (Phase 7); customers reach `/s/<code>` from the code and `/o/<token>` from their own ticket, visitor pass or booking link
- `/app/products`, `/app/integrations`, `/app/settings`, `/app/admin` — Product QR & warranty, Integrations & API, Settings & billing, Admin console (Phase 8); buyers reach `/p/<secret token>` from a serialized product code
- `/docs` — the API and webhook reference
- `/app/*` — the app shell with sidebar; every sidebar item is now a real screen

Tokens: `tailwind.config.ts` (colours, status pills, radii, shadow, `bg-marble`) and `app/globals.css`.
Primitives: `components/ui`. Shared: `components/site`, `components/app`, `components/qr/QRMark.tsx`.

`npm run check:qr` decodes the three QR styles on `/styleguide` with ZXing (needs a running server and Playwright).

## Book-a-demo form

`/contact` posts to `/api/demo-request`. Set `DEMO_REQUEST_WEBHOOK_URL` (see `.env.example`) to forward submissions as JSON to Zapier, Make, a CRM, etc. With no webhook set, the API returns 503 and the form says it isn't connected yet instead of pretending to send.

## Auth (Phase 3)

Sign-up and log-in use a 6-digit code sent on WhatsApp. Sessions are signed HttpOnly cookies; no database yet.

```bash
cp .env.example .env.local   # then set AUTH_SECRET (openssl rand -base64 32)
npm run dev                  # OTP codes print on the server console and show on the onboarding page
npm run check:auth           # API tests; needs the dev server running
```

- **Dev provider** (default outside production): the code is shown on the onboarding page. It is **disabled in production builds**; with no provider configured, sending a code returns 503.
- **WhatsApp provider:** `AUTH_OTP_PROVIDER=whatsapp` plus `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_OTP_TEMPLATE` (an approved *authentication* template). Not yet tested against a live Meta account.
- **Limits:** codes expire in 5 minutes, 5 wrong tries lock a code, 30s between sends, 5 sends per number per hour. These counters are in memory (one server process); move them to Postgres in Phase 4 so they hold across serverless instances.
- **Workspace data** (business, industry, goals, location) is kept in a signed cookie as a stop-gap, per browser. Phase 4 replaces `lib/workspace.ts` with Postgres.
- **Not built:** Google sign-in (button explains it isn't set up), Google Business Profile connect and logo upload (wizard step 4 points to Integrations/Settings).

## Database and QR codes (Phase 4)

Everything is stored in Postgres: users, workspaces, locations, folders, QR codes, scans and the OTP limits. Migrations in `lib/db/migrations.ts` run automatically on first use.

- **`DATABASE_URL` set:** uses that Postgres (Supabase, Neon, RDS, local...). **Required in production.**
- **Not set (dev only):** an embedded Postgres (PGlite) in `.data/pglite`, so `npm run dev` needs no setup. Delete `.data/` to reset it.

```bash
npm run check:codes   # QR create/validate, plan limits, redirects, scan logging, bulk actions, isolation (dev server running)
```

**Redirect service.** `GET /q/<code>` logs the scan, then 307-redirects to the destination (a paused, draft, expired or not-yet-live code shows a friendly page; unknown codes 404). To serve it on a short domain set `SHORT_LINK_HOST=skn.to` and `SHORT_LINK_BASE=https://skn.to` (see `.env.example`); `proxy.ts` rewrites that host's `/<code>` to `/q/<code>`.

**Scans** store a keyed hash of IP + user agent (never the raw values), device (Android / iPhone / other), browser language (English / Tamil / Hindi / other) and city when the host supplies one (Vercel and Cloudflare headers). Bots and link-preview fetchers are not counted. Analytics buckets are in IST.

**What's live in Studio.** Website, WhatsApp, UPI (static), Wi-Fi (static), Google Maps and PDF link. The other types are visible but disabled until their customer pages exist (Phases 5-8). Wi-Fi and UPI always encode their data directly; the rest are dynamic by default (editable, scan-counted) and can be made static. Free plans include 3 dynamic codes; static codes are unlimited.

**Not built yet:** bulk CSV import (needs the Growth plan, so it waits for billing in Phase 8), PDF/EPS/table-tent/sticker-sheet exports, smart redirects, password-protected codes, scheduled reports, print shop.

## Review Assistant (Phase 5)

A **Review page** QR (Studio, Engage group) opens a rating page: `/q/<code>` logs the scan and redirects to `/r/<code>`.

- **Google policy:** every customer, at every star rating, sees "Post on Google". Ratings of 1-3 *also* get a private-feedback form as an extra choice, never a filter. The Google link must be on a Google-owned domain (or a Place ID); anything else is refused when the QR is saved. `npm run check:reviews` and the browser tests assert the link is present at all five ratings.
- **Languages:** English, Tamil and Hindi, chosen from the browser language or `?lang=`. A business's own question and chips are shown as typed in every language (only the defaults are translated). **The Tamil and Hindi wording is a first translation: have a native speaker review it before launch.**
- **Suggested text** is template wording built from the chips the customer taps (with variations), not AI. The customer can edit it. Wiring an LLM in later only means replacing `suggestReview()` in `lib/review-i18n.ts`.
- **Data:** every rating, "went to Google" click and private note is stored per workspace (`review_responses`, `feedback`). Phone numbers on feedback are optional and shown only to the owner. Public endpoints are bound to the visitor that created a rating, rate-limited (20 ratings/hour per visitor) and have a honeypot.
- **Owner screen:** KPIs, insights computed from the numbers, recent ratings, private-feedback inbox (open / in progress / resolved), rating split, staff leaderboard (from the "Staff member" field on each Review QR), and the rating-page settings.

```bash
npm run check:reviews   # API tests: QR validation, redirect, languages, visitor binding, rate limit, privacy, isolation (dev server running)
```

**Not built:** reading and replying to Google reviews and review widgets (need Google Business Profile, with Integrations), AI-written text and AI reply drafts (need an LLM key), WhatsApp alerts to the manager and auto-created tickets (Phase 7), thank-you offers on the review page (not built yet).

## Leads, Offers & loyalty, Pages (Phase 6)

Six QR types are now live (all dynamic): **Menu**, **Lead form**, **Coupon**, **Loyalty card**, **Business card** and **Link-in-bio**. `/q/<code>` logs the scan and redirects to `/s/<code>`, which shows the matching customer page. A code points at something you build first, so a printed code can be edited without reprinting: pages, forms and offers are chosen in the Studio, and the Studio only lists published pages. Pages and forms that a live code uses can't be unpublished or deleted.

- **Pages** (`/app/pages`): menu with sections, prices, veg marks, tags, sold-out toggle and an optional "Order on WhatsApp" cart; business card with a vCard download; link-in-bio. Live phone preview, draft/publish.
- **Leads** (`/app/leads`): lead forms (choose the fields and the "interested in" choices), a five-stage pipeline with owner and notes, contacts (created from forms, coupons and loyalty; CSV import with per-row reasons; opt-in is stored only when the customer ticked it), and live segment counts.
- **Offers** (`/app/offers`): coupons with a code prefix, validity, start/end, per-customer and total limits, pause; every claim gets a one-use code. **Redeem a code** looks a code up and marks it redeemed atomically (two staff redeeming at once: only one succeeds). Loyalty: stamps needed, reward, staff PIN, card expiry.
- **Loyalty rules:** the customer joins with a phone number; staff add a stamp by entering a 4-digit PIN on the customer's phone. One stamp per card per day, 5 wrong PINs lock that card for 15 minutes, and the earning of a reward creates a one-use `RWD-` code redeemed the same way as a coupon. The PIN is stored as a keyed hash (it uses `AUTH_SECRET` in production). The public card never returns the full number or the name.
- **Languages:** the chrome of every customer page is English, Tamil and Hindi (browser language or `?lang=`). What a business types (items, offers, form titles) is shown as typed. **The Tamil and Hindi wording is a first translation: have a native speaker review it before launch.**
- **Abuse limits:** public endpoints are throttled per visitor (leads 10/hour, loyalty joins 10/hour, plus the earlier review limits), carry a honeypot, and only accept codes whose QR is active and whose target is published.

```bash
npm run check:engage   # API tests: pages, lead forms, contacts import, coupons, redeem, loyalty, isolation (dev server running)
```

`check:engage` also covers multi-day loyalty rewards when `DATABASE_URL` points at the server's database (it moves a card's last stamp back a day); without it those checks are skipped. No new environment variables.

**Not built:** sending WhatsApp broadcasts, win-back messages and digital bills (they need WhatsApp sending and a billing connection, with Integrations; the screens say so and the buttons are disabled), thank-you offers on the review page, landing pages, drag-and-drop in the pipeline (each card has a stage select instead), a loyalty rule per spend, click tracking on link-in-bio links, bulk CSV QR creation (billing-gated).

## Tickets, Attendance, Bookings & Real estate (Phase 7)

Six more QR types are live (all dynamic): **Feedback → ticket**, **Asset service**, **Attendance point**, **Visitor pass**, **Booking / event** and **Real estate plot**. A scan opens `/s/<code>`. What a customer does next gives them their own unguessable link, `/o/<token>`, to see a ticket's progress, a visitor pass or a booking. Nothing on those links shows a phone number, internal notes or other people's data.

- **Tickets & assets** (`/app/tickets`): tickets from a Feedback code, an Asset code, a private-feedback note in Reviews ("Make ticket", once per note) or by hand. SLA hours by priority (breaching tickets are highlighted), assignee, internal notes, and replies the customer sees on their ticket page. Assets get a code like AST-0001, a service interval and a service log that moves the next due date.
- **Attendance & visitors** (`/app/attendance`): staff and labour with their own IDs (ST-0001, LB-0002) and shifts; check-in points with a geofence. A worker scans, enters their ID and the last 4 digits of their number, and the phone's location is checked against the point. The first scan checks in, a later scan checks out; late arrivals follow a grace period you set. Visitors request a pass, you approve it, and you check them in and out; a pass lasts until the end of the day. Export a month as CSV for payroll (figures only, not a payroll calculation).
- **Bookings & events** (`/app/bookings`): services with duration, price and staff; weekly opening hours; a week calendar. Time slots are built from your hours (every 30 min, up to 2 weeks ahead, 30 min notice) and a slot is taken under a database lock, so two customers can't get the same one. A service can ask for your confirmation first. Events have a ticket limit that cannot be oversold, a ticket code with a QR, and a gate scanner that checks a code in once.
- **Real estate plots** (`/app/real-estate`): projects with numbered plots on a layout map (roads between rows), plot details and status (available, on hold, booked, sold), CSV import, a QR per plot, and buyer enquiries. An enquiry also becomes a lead (source PLOT QR) and a contact in Leads.
- **Languages:** every customer page is English, Tamil and Hindi (browser language or `?lang=`). **The Tamil and Hindi wording is a first translation: have a native speaker review it before launch.**
- **Abuse limits:** public endpoints are throttled per visitor and carry a honeypot. Check-in guesses are also limited per worker ID, so the last 4 digits can't be brute-forced, and an unknown ID and a wrong number look the same.

```bash
npm run check:ops   # API tests: tickets, assets, attendance, visitors, bookings, events, plots, isolation (dev server running)
```

`check:ops` also runs the checks that need time to pass (checking out later, an expired pass) when `DATABASE_URL` points at the server's database; without it those are skipped. No new environment variables.

**Not built:** selfie check-in and photos on tickets (need file storage); a technician page with a checklist and customer OTP to close a ticket; WhatsApp reminders, escalations, alerts and the daily summary (need Integrations); CSAT after resolution; shifts as a separate screen, leave and a payroll calculation; owner-created bookings; per-gate counts at events; payments for bookings and event tickets; printing a whole sheet of plot QRs at once (a QR is made per plot, using one dynamic code each).

## Product QR, Integrations, Settings & Admin (Phase 8)

- **Product QR, warranty & authenticity** (`/app/products`, Enterprise): add a product, generate up to 20,000 serial codes per batch (`AQ-26-000001`…). Each serial has its own secret 64-bit token and URL (`/p/<token>`), so a serial can't be guessed from its neighbours. Download a CSV for the packaging-line printer or print an A4 sheet of QR codes (60 a page). The buyer's page says *Genuine* on the first scan and *Scanned before* when another phone has scanned it, and offers warranty registration, "Book service" (which raises an ordinary ticket) and "Report this seller". A code is flagged and an alert raised when 3 different devices scan it, when it is scanned in two cities within a day (only where the host passes a city header, e.g. Vercel or Cloudflare), when it is registered twice with different numbers, or when a buyer reports it. Alerts are signals, not proof. A repeat scan on the same phone within 10 minutes is not counted again, and link-preview robots don't count.
- **API** (`/docs`, `/app/integrations`, Enterprise): keys are shown once and stored only as a hash. Scopes: read-only, create QR codes and batches, everything. `GET/POST /v1/qr`, `GET /v1/qr/{id}`, `POST /v1/batches`, `GET /v1/codes/{serial}`, 120 requests a minute per key. Every change an API key makes is in the audit log.
- **Webhooks:** `scan.created`, `lead.created`, `review.received`, `ticket.created`, `booking.created`, `warranty.registered`, `counterfeit.flagged`. Each request is signed (`Skanor-Signature: t=…,v1=HMAC-SHA256`), sent after the response so a slow endpoint never slows a customer, retried once, and an endpoint is paused after 20 failures in a row. URLs must be https and resolve only to public addresses; redirects are never followed (`npm run check:net` tests the address rules, including IPv6 and IPv4-mapped spellings). There is no durable retry queue.
- **Settings** (`/app/settings`): business profile (name, category, GSTIN, default scan-page language), locations (add, edit, make primary, remove), plan and usage, an audit log, CSV export of contacts, leads, tickets, bookings, ratings and scans, a retention period (24 months, 12 months, forever; older scans and leads are deleted when you choose it and once a day after), and deleting the workspace (type the business name).
- **Admin console** (`/app/admin`): only numbers in `ADMIN_PHONES` (everyone else gets a 404). Tenants with search and filter, plan changes, suspend and resume (a suspended business's QR codes, rating page, customer pages and product pages stop working and its owner sees a notice), "Log in as" (4 hours, with a banner, recorded in the tenant's audit log, and an admin can't delete a workspace while viewing it), two real platform switches (new sign-ups, webhook delivery) and a health panel of what the platform can measure itself.
- **Plans:** Product QR and the API are Enterprise. There is no online billing yet, so an admin changes a tenant's plan after talking to them.

```bash
# the server needs an admin number, and (to test real delivery to a local receiver) the dev-only bypass
ADMIN_PHONES=+919000000001 WEBHOOK_ALLOW_PRIVATE=1 npm run dev
npm run check:platform   # settings, API keys and /v1, webhooks, products, admin, plan gating
npm run check:net        # which addresses a webhook may never be sent to (no server needed)
```

Without `WEBHOOK_ALLOW_PRIVATE`, `check:platform` instead checks that local and internal addresses are refused. Set `DATABASE_URL` to the server's database to also run the retention purge and "nothing left behind after delete" checks.

**Not built:** online billing and invoices (so MRR, paying tenants and trials stay as placeholders); team members and roles; brand colours and custom scan-page domains; WhatsApp or email notifications and a notification matrix; two-factor and Google sign-in; ready-made connections to Google Business Profile, WhatsApp, Shopify, WooCommerce, Zoho, Tally, Razorpay and Orkha (use webhooks and the API meanwhile); white-label for agencies; invoice photos on warranty registrations (an invoice number instead); service requests as their own screen (they are tickets from PRODUCT QR); dealers; the admin print-orders queue and support inbox.

## File storage

Logos and PDFs. One upload endpoint (`POST /api/files`, a form with `file` and `purpose`: `logo`, `document` or `image`) and one public address, `/f/<id>`.

- **What is accepted:** PNG, JPEG, WebP and PDF only, judged from the file's first bytes, never from its name or the browser's type (`lib/file-sniff.ts`). SVG and HTML are refused, because they can carry scripts. Limits: logo 1 MB (at least 64 px, at most 4096 px), PDF 8 MB, image 5 MB (the proxy clones request bodies up to 10 MB).
- **Where the bytes go:** Postgres by default (nothing to set up), or S3-compatible storage when `S3_BUCKET`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` are set (AWS S3, Cloudflare R2, MinIO, Supabase Storage; `S3_ENDPOINT` for the last three). Requests are signed with Signature V4 in `lib/s3-sign.ts` (checked against AWS's published examples), using plain `fetch`, so there is no SDK. Each file row records where its bytes are, so switching later leaves older files readable. Set `APP_URL` so the links to files use your real domain.
- **Serving:** `/f/<id>` is public by design (that is how a QR code reaches a PDF); the id is an unguessable UUID. Served with the type found in the bytes, `nosniff`, a sandbox policy on images, and a year of caching (the id changes whenever the content does).
- **Where it is used:** the workspace logo (Settings, onboarding step 4) shows in the header of every customer page and, if you switch it on, in the centre of a QR code (drawn with the highest error correction; the PNG and SVG downloads carry the logo inside them). A PDF QR code can upload its file instead of linking to one; real-estate brochures and product manuals can be uploaded the same way. Settings lists every file with its use ("In use" means a QR code, page, product, brochure or the logo links to it), copy link, delete, and "delete unused".
- **Limits:** each plan includes a storage allowance (`STORAGE_MB` in `lib/plans.ts`: 20 MB Free to 10 GB Enterprise, defaults until pricing is confirmed). The same file uploaded twice is stored once. A new logo replaces the old one. 60 uploads an hour per workspace. Deleting a workspace removes its objects from S3 as well.

```bash
npm run check:storage   # file types, upload rules and the S3 signing examples (no server needed)
npm run check:files     # needs the dev server; set MOCK_S3 to run it against scripts/mock-s3.mjs (see test:all)
```

`npm run test:all` runs `check:files` twice: once on Postgres storage and once against a mock S3 server that verifies every request's signature, including an outage during upload and cleanup on delete.

**Not built:** photos from customers (selfie check-in, ticket photos, an invoice photo for warranty claims), a gallery of images for menus and pages, direct browser-to-S3 uploads for large files, virus scanning, image resizing.
