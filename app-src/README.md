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
