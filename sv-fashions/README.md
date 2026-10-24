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

## Stock photos (preview only)
The hero, work gallery, service cards, About and Instagram tiles use free [Pexels](https://www.pexels.com) photos of women in
sarees / bridal wear, tailors and stitching, linked straight from Pexels' image CDN
(`images.pexels.com/photos/<id>/pexels-photo-<id>.jpeg`). If a photo fails to load, the page falls back to the matching
illustration in `assets/img/` (`data-fb` attribute).

**These are stock photos, not the studio's work** — replace them with the studio's own photos before launch: put the files in
`assets/img/`, then change `src` (and the `alt` / caption) in `index.html`. The gallery captions describe the stock photos.

Photo pages (open `https://www.pexels.com/photo/<id>/` to see photographer and licence): hero 34345410, 12726134, 9852970 ·
services 15384798, 12411105, 19556879, 7778035 · about 6461195 · Instagram tiles 3838680, 8517098, 6766353, 7148066, 31935139, 7147578 ·
gallery 4427080, 2119095, 29172782, 28213789, 12792004, 33078836, 7486650, 28943572, 5858761, 33306356, 36114634, 20627903.

## Mobile
Most visitors are on phones: the first screen holds the headline, WhatsApp button and the start of the hero photo; the order bar slides in at the bottom once the hero buttons scroll away (and hides at the order form);
fonts are limited to two families; images are lazy-loaded with fixed aspect ratios; blur effects are off on phones; the photo viewer supports swipe.
