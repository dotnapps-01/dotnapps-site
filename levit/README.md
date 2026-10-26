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
- **Hero: the boutique entrance.** A sticky full-width photo of the storefront with a warm sign glow. Scrolling walks you towards the door (the scene scales into it, the headline fades, a flash of light hands over to the shop), the pointer shifts the shopfront slightly, and five hotspots on the mannequins and racks open product quick views. `--p` (scroll progress) is set in `js/app.js`; the rest is CSS. Reduced-motion users get a static hero.
- `extras/rack-hero/` — the previous 3D hero, kept for reuse and not loaded by the page: a Three.js rail with four garments (hoodie, puffer, jeans, knit) driven by a position-based cloth solver (`cloth.js`), sewing patterns (`patterns.js`) and procedural fabrics (`fabrics.js`). To use it again, restore the import map and canvas markup from git history (the commit before "boutique entrance").
- `js/garments.js` / `js/products.js` — catalogue (INR) and the tintable hanger illustrations used in the grid
- `js/app.js` — filters, quick view, bag drawer, simulated checkout, search, wishlist (bag and wishlist persist in `localStorage`)
- `fonts/` — self-hosted WOFF2 (Three.js r160 lives with the unused 3D hero in `extras/rack-hero/vendor/`)

Checkout is a demo: no payment is taken and nothing is sent anywhere.
Replace the illustrations with product photography by adding a `photo` path to a product in `products.js`.
