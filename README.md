# dotnapps-site

Marketing site for **Dotnapps** — a product & engineering studio that also runs
its own product line, **Business OS**.

*Unlock your digital potential with us.*

## What's here

A single self-contained page: [`index.html`](index.html). No build step, no
dependencies — open it in a browser or serve the folder statically.

- Monochrome design system (black / white / greys, one blue for focus & links)
- Space Grotesk type, light + dark themes with a manual toggle
- Sections: hero (orbit motif), tech stack, selected work, Business OS,
  24 services across 5 practices, industries, process timeline, engagement
  models, studio-vs-freelancer-vs-hire comparison, category-tabbed FAQ,
  careers, and a project brief form (composes a `mailto:`)
- Scroll-reveal and hover motion throughout; everything respects
  `prefers-reduced-motion`
- Responsive from ~320px up

## Local preview

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy

Live at **https://www.dotnapps.com** (Vercel, auto-deploys on push to `main`).
`dotnapps.com` 308-redirects to `www`. Config in [`vercel.json`](vercel.json);
no build step. `robots.txt` / `sitemap.xml` / `og.png` / `favicon.svg` are
served from the repo root.

Any static host works too — it's a single `index.html`.

## Admin (`/admin`)

A private admin for leads, hero taglines, page copy and settings. It runs on Vercel serverless functions in `api/`.

**To switch it on** (Vercel → Project → Settings → Environment Variables, then redeploy):

1. `ADMIN_PASSWORD` — the password you type at `/admin`. Changing it signs everyone out. (Optional: `ADMIN_SECRET`, any long random string, to sign sessions.)
2. A Redis store — add **Upstash for Redis** from the Vercel Marketplace. It sets `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (Vercel KV's `KV_REST_API_URL` / `KV_REST_API_TOKEN` also work).

Until both are set, `/admin` shows a setup checklist and the site behaves as before (forms open an email).

**What it does**

- **Leads** — every form on the site posts to `/api/lead` and is saved. Status, notes, search, CSV export.
- **CRM** — Settings → CRM integration forwards each new lead to a webhook (JSON or form fields, optional auth header). The secret is stored server-side only. Webhook URLs must be `https` and not point at private addresses.
  - **Dotnapps CRM (workspace.dotnapps.com):** use the *Quick setup* box — enter the workspace slug and the secret from the CRM's `INBOUND_LEAD_KEYS`. It fills in `https://workspace.dotnapps.com/api/inbound/leads?org=<slug>` and an `Authorization: Bearer …` header. New leads arrive as `WEBSITE` leads with the message as a note; repeat emails add a note instead of a duplicate; careers applications are not sent (you can choose which forms go). Needs the matching endpoint deployed in `apps/crm` (see its `docs/OPERATIONS.md`).
- **Hero / Content / Settings** — taglines, Services and Products copy, social links, contact email and a site notice. Saved to the store and read by the site from `/api/config` (changes show within about 15 seconds).

**Local testing without a real store:** `DN_STORE=memory ADMIN_PASSWORD=test vercel dev` keeps data in memory only.
