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
- **Hero: the wordmark, knitted.** The giant LEVIT letters are a waffle-knit surface drawn by one WebGL fragment shader (`js/hero-wordmark.js`, no libraries): a point light follows the cursor, the letters are rounded into soft cushions, a press pinches the fabric, and a swatch changes the knit colour and the page tint. Portrait screens stack the letters in a column. Without WebGL a CSS knit pattern clipped to the text stands in.
- `extras/3d-heroes/` — earlier hero experiments, kept and not loaded: the hanger rack (`hero3d.js`), the floating garments (`hero-float.js`), and the cloth solver, sewing patterns and procedural fabrics they share. To run one, restore the import map and canvas markup from git history and point the modules at `extras/3d-heroes/vendor` (Three.js r160).
- `js/garments.js` / `js/products.js` — catalogue (INR) and the tintable hanger illustrations used in the grid
- `js/app.js` — filters, quick view, bag drawer, simulated checkout, search, wishlist (bag and wishlist persist in `localStorage`)
- `fonts/` — self-hosted WOFF2

Checkout is a demo: no payment is taken and nothing is sent anywhere.
Replace the illustrations with product photography by adding a `photo` path to a product in `products.js`.
