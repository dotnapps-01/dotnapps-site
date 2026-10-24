# SV Fashions — website

Showcase site for **SV Fashions** (Bespoke Tailoring & Fashion Designing, Selvapuram, Coimbatore) — built by Dotnapps.
Not e-commerce: visitors browse the work, then order by DM (Instagram / WhatsApp).

Static site — no build step. `python3 -m http.server 8080` in this folder, or deploy the folder as-is.

## Files
- `index.html` — all content. Every translatable element has a `data-ta` attribute holding its Tamil text (EN / தமிழ் toggle).
- `styles.css`, `script.js` — design and behaviour.
- `assets/` — logo (cut from the Instagram profile picture), favicon, share image.
- `assets/img/*.svg` — **placeholder illustrations**, not real photos.

## Before launch
1. **Replace the placeholder images** with the studio's real photos. Drop the files into `assets/img/`
   (e.g. `blouse-aari.jpg`) and update the `src` in `index.html`. Photos should be roughly 4:5 (portrait). Update the `alt` text too.
2. **WhatsApp**: put the number in `CONFIG.whatsapp` at the top of `script.js` (digits with country code, e.g. `919876543210`).
   Until then all WhatsApp buttons stay hidden and everything points to Instagram DM.
3. **Diwali offer strip** (top of `index.html`): confirm ₹1500 and the end date with the client, or delete the block.
4. Confirm the Tamil copy with the client, and the "How it works" steps and About text match how they actually work.
5. Set the real domain: absolute `og:image` URL and a `canonical` link; add a `sitemap.xml` if it gets its own domain.
6. Optionally add exact opening hours / phone number to the "Find us" card.
