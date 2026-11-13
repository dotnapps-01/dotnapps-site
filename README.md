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

## Chat assistant

A floating chat widget on every page: an AI assistant (BLOOP) first, with a
live human handoff ("Talk to a human"). **Live chats appear in the Chats tab
of the admin dashboard (`/admin`)**; there is no email. Replies show up in the
visitor's chat box.

- `chat.js` / `chat.css`: the widget (follows the light/dark theme). The bot is
  **BLOOP**; its face is drawn in `chat.js` (`face()`) from the same shapes as
  `bloop.svg`. It has 15 expressions (idle, happy, excited, wink, love, cool,
  thinking, typing, help, success, error, alert, online, processing, offline) and
  reacts to the chat: typing while it waits, thinking after 4s, love for thanks,
  error/alert when something fails, asleep when the visitor's connection drops.
  The launcher is just BLOOP, built like the round menu button on phones: an outlined
  circle with a solid disc and the face in the opposite colour (white on black on the
  light site, black on white on the dark one); the chat box uses the site's own colours.
  A visitor is greeted once (30 days) by a small pop-up with a soft chime: right after
  they answer the cookie banner, or a few seconds in when there is no banner. Browsers
  only allow sound after a tap, so with no tap the greeting appears silently. On phones
  the chat is a compact card, with a button in the header to make it full screen.
  The keyboard never opens by itself; when it is open the suggestions and footer step aside.
- `api/chat.js`: AI replies (`POST /api/chat`). Tries Groq (`GROQ_MODEL`, then
  `GROQ_FALLBACK_MODEL`), then Gemini (`GEMINI_MODEL`); skips any provider
  whose key isn't set.
- `api/_knowledge.js`: the AI's system prompt and company facts. **Edit this
  to change what the bot says** (pricing, hours, new services).
- `api/live.js`: visitor side of human chat (start, send, end, poll). Name and
  email are optional.
- `api/chats.js` + the **Chats** tab in `admin.html`: the team side. It reuses
  the admin login (`ADMIN_PASSWORD`), so there is no extra password. Reply, end
  or delete chats, and see the AI transcript. While the dashboard is open it
  polls every few seconds, shows a badge and a toast for new messages, and tells
  the widget that someone is online.
- `api/_chatlib.js`: shared chat helpers (Upstash Redis over REST, limits).
  `api/_lib.js` stays the admin's own helper file.

Chats are stored in the same Upstash Redis database the admin uses (keys
`dn:c:*`, `dn:m:*`, `dn:idx`, `dn:agent:seen`) and deleted 3 days after the last
message. Without Redis, "Talk to a human" shows an email fallback instead.

Environment variables (Vercel -> Settings -> Environment Variables), then redeploy:

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` / `GEMINI_API_KEY` | AI replies (set at least one). Keys: console.groq.com, aistudio.google.com |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_*`) | Already needed by the admin; live chat reuses them |
| `ADMIN_PASSWORD` | Already needed by the admin; signs you in to the Chats tab |
| `GROQ_MODEL`, `GROQ_FALLBACK_MODEL`, `GEMINI_MODEL` | Optional model overrides |

Rate limits on the chat endpoints are in-memory, so best-effort only. Test
locally with `npx vercel dev` (the plain `http.server` preview has no `/api`).

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
