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
