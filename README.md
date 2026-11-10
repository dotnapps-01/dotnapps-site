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

A floating chat widget on every page: an AI assistant first, with a live
human handoff ("Talk to a human").

- `chat.js` / `chat.css`: the widget (follows the light/dark theme). The bot is
  **BLOOP**; its face is drawn in `chat.js` (`face()`) from the same shapes as
  `bloop.svg`, with idle (blinking), typing and happy expressions.
- `api/chat.js`: AI replies (`POST /api/chat`). Tries Groq (`GROQ_MODEL`, then
  `GROQ_FALLBACK_MODEL`), then Gemini (`GEMINI_MODEL`); skips any provider
  whose key isn't set.
- `api/_knowledge.js`: the AI's system prompt and company facts. **Edit this
  to change what the bot says** (pricing, hours, new services).
- `api/live.js`: visitor side of human chat. The visitor leaves an email, the
  team is emailed, and replies appear in the same chat box (the widget polls).
- `api/agent.js` + `agent.html`: the team's private inbox at **/agent**
  (sign in with `AGENT_TOKEN`). Reply, end chats, see the AI transcript.
  Opening the link in the notification email jumps to that conversation.
- `api/_lib.js`: shared helpers (Upstash Redis over REST, Resend email, limits).

All free tiers, no npm dependencies. Environment variables (Vercel ->
Settings -> Environment Variables), then redeploy:

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` / `GEMINI_API_KEY` | AI replies (set at least one). Keys: console.groq.com, aistudio.google.com |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Stores live chats. Free database at upstash.com, or Vercel Marketplace -> Upstash Redis (that sets `KV_REST_API_URL` / `KV_REST_API_TOKEN`, which also work) |
| `AGENT_TOKEN` | Password for /agent. Use a long random string |
| `RESEND_API_KEY` | Sends the "new chat" email (resend.com, free) |
| `NOTIFY_EMAIL` | Where notifications go (default `hello@dotnapps.com`) |
| `RESEND_FROM` | Sender, e.g. `Dotnapps Chat <chat@dotnapps.com>`. Needs a domain verified in Resend. Without it, Resend only delivers to your own Resend-account email |
| `SITE_URL` | Base URL for links in emails (default `https://www.dotnapps.com`) |
| `GROQ_MODEL`, `GROQ_FALLBACK_MODEL`, `GEMINI_MODEL` | Optional model overrides |

Without Redis, "Talk to a human" shows an email fallback instead. Chats are
deleted 3 days after the last message. Emails are capped at 20/hour and
60/day, and one per chat per 3 minutes. Rate limits on the chat endpoints
are in-memory, so best-effort only.

Test locally with `npx vercel dev` (the plain `http.server` preview has no
`/api`).

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
