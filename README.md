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

A floating chat widget on every page, backed by free LLM tiers.

- `chat.js` / `chat.css`: the widget (follows the light/dark theme). Set
  `WHATSAPP` at the top of `chat.js` to show a WhatsApp handoff link.
- `api/chat.js`: Vercel serverless function (`POST /api/chat`). Tries Groq
  (`GROQ_MODEL`, then `GROQ_FALLBACK_MODEL`), then Gemini (`GEMINI_MODEL`),
  and skips any provider whose key isn't set.
- `api/_knowledge.js`: the system prompt and company facts. **Edit this to
  change what the bot says** (add pricing, hours, new services).

Setup: create free keys at console.groq.com and aistudio.google.com, then in
Vercel -> Settings -> Environment Variables add `GROQ_API_KEY` and
(optionally) `GEMINI_API_KEY`, and redeploy. Keys never reach the browser.
Optional overrides: `GROQ_MODEL`, `GROQ_FALLBACK_MODEL`, `GEMINI_MODEL`.

Test locally with `npx vercel dev` (the plain `http.server` preview has no
`/api`; the widget then shows its "contact us" fallback). Per-IP rate limits
are in-memory, so best-effort only.

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
