# LEVIT — womenswear storefront

Static e-commerce front end for the LEVIT womenswear brand, served at `/levit`.
No build step: open `levit/index.html` through any static server.

```bash
cd levit && python3 -m http.server 8080
```

## Design system (taken from the logo)
- **Sand** `#D8C2AA` ground and **ink** `#0B0907` wordmark come from the logo; Playfair Display (a high-contrast serif close to the logo) + Jost for UI text
- Supporting accents so the page is not all beige: sage, lilac (from the poster flowers), blush, butter, forest green and wine (from the window dress); the hero background follows the chosen colourway
- **Rust** `#A8531E` from the knit, **gold** `#E7CD8B` from the boutique sign glow
- Arch frames echo the alcoves in the lookbook photography

## What's inside
- **Hero: the dress on a rail (white).** The dress is a cut-out product photo (`img/dress-camel.webp`) baked with a hanger and hook into one texture and drawn by a small WebGL mesh (`js/hero-hang.js`, no libraries). Per-frame physics swings it from the hook as a damped pendulum, lags the skirt behind the shoulders, ripples the hem in a breeze and turns it slightly. Hover pushes it, dragging grabs it, scrolling nudges it. The swatches recolour the dress from its own shading and tint the arch behind it. Without WebGL the plain photo sways with a CSS animation. Swap the dress by replacing the cut-out and adjusting `PAD`, `CX` and `SHOULDER` at the top of `hero-hang.js`.
- `extras/hero-variants/` — earlier hero experiments, kept and not loaded: the knit wordmark shader (`hero-wordmark.js`), the 3D hanger rack (`hero3d.js`) and floating garments (`hero-float.js`), with the cloth solver, patterns and fabrics they share and the Three.js build they need (`vendor/`).
- `js/garments.js` / `js/products.js` — catalogue (INR) and the tintable hanger illustrations used in the grid
- `js/app.js` — filters, quick view, bag drawer, simulated checkout, search, wishlist (bag and wishlist persist in `localStorage`)
- `fonts/` — self-hosted WOFF2

Checkout is a demo: no payment is taken and nothing is sent anywhere.
Replace the illustrations with product photography by adding a `photo` path to a product in `products.js`.
