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
- `/docs` — placeholder until the Integrations/API screen (Phase 8)
- `/app/dashboard` and the other `/app/*` routes — app shell with sidebar (placeholders until Phases 4–8)

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

**Not built yet:** bulk CSV import (needs the Growth plan, so it waits for billing in Phase 8), PDF/EPS/table-tent/sticker-sheet exports, logo in the QR centre, smart redirects, password-protected codes, scheduled reports, print shop.

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
