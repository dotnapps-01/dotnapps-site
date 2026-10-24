# SV Fashions — website

Showcase site for **SV Fashions** (Bespoke Tailoring & Fashion Designing, Selvapuram, Coimbatore) — built by Dotnapps.
Not e-commerce: visitors browse the work, then order on WhatsApp (+91 91500 99500).

Static site — no build step. `python3 -m http.server 8080` in this folder, or deploy the folder as-is.

## Files
- `index.html` — all content (English only).
- `styles.css`, `script.js` — design and behaviour.
- `assets/logo.svg` (full) and `assets/logo-mark.svg` (SV only) — the logo re-drawn as clean vector from the original screenshot, no shadow. PNG icons and `og.png` are rendered from them.
- `assets/` — also favicon and share image.
- `assets/img/*.svg` — **placeholder illustrations**, not real photos.

## Before launch
1. **Replace the placeholder images** with the studio's real photos. Drop the files into `assets/img/`
   (e.g. `blouse-aari.jpg`) and update the `src` in `index.html`. Photos should be roughly 4:5 (portrait). Update the `alt` text too.
2. **WhatsApp number** is `CONFIG.whatsapp` in `script.js` and the `wa.me/…` / `tel:` links in `index.html` (search for `919150099500`). Confirm the number with the client.
3. **Diwali offer strip** (top of `index.html`): confirm ₹1500 and the end date with the client, or delete the block.
4. Confirm the "How it works" steps and About text match how they actually work.
5. Set the real domain: absolute `og:image` URL and a `canonical` link; add a `sitemap.xml` if it gets its own domain.
6. Optionally add exact opening hours / phone number to the "Find us" card.

## Deploying
Vercel: new project from this repo, **Root Directory = `sv-fashions`**, preset *Other*, no build command.
Cloudflare Pages: build output directory = `sv-fashions`, no build command.

## Preloader
The SV mark draws itself on load (inline SVG + CSS, see `.pre` in `styles.css`; minimum 2.5 s, set in `script.js`). It is skipped for `prefers-reduced-motion`.
