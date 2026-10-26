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
- `js/hero3d.js` — Three.js hero. A black hanger on a rail is a damped pendulum; the knit body and each sleeve are separate pendulums driven by the hanger's acceleration, so they lag and settle. Pointer sweeps, drag-and-flick, scroll and a faint breeze all apply forces. Falls back to the photo when WebGL is unavailable.
- `js/garments.js` / `js/products.js` — catalogue (INR) and the tintable hanger illustrations used in the grid
- `js/app.js` — filters, quick view, bag drawer, simulated checkout, search, wishlist (bag and wishlist persist in `localStorage`)
- `vendor/` — Three.js r160 (self-hosted), `fonts/` — self-hosted WOFF2

Checkout is a demo: no payment is taken and nothing is sent anywhere.
Replace the illustrations with product photography by adding a `photo` path to a product in `products.js`.
