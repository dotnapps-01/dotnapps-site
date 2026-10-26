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
- `js/hero3d.js` — Three.js hero: a rail of four garments (knit, ruched dress, shacket, wide-leg trousers). Each hangs on a hanger that swings as a damped pendulum; the clothes are real cloth, simulated per frame. Pointer sweeps brush the fabric, drag-and-flick grabs a hanger, scrolling and a breeze push everything. The solver degrades gracefully on slow devices and the photo replaces the scene when WebGL is unavailable.
- `js/cloth.js` — position-based cloth: front and back pattern pieces stitched at the seams, pinned to the hanger, with stretch, shear, bend, thickness, elasticated cuffs, wind and fold-based ambient occlusion. The simulated mesh is subdivided with curved edges for the visible surface, so silhouettes and folds render smooth
- `js/patterns.js` — the sewing patterns (outline + edge tags); `js/fabrics.js` — procedural weaves painted in pattern space with colour, normal and roughness/metalness maps (heathered waffle knit with rib trims, sequinned satin where each sequin is a tilted metallic disc, twill with pockets, buttons and topstitching, voile, crepe) plus a tiling fibre bump. Shadows use contact-hardening PCSS: sharp near the cloth, softer with distance
- `js/garments.js` / `js/products.js` — catalogue (INR) and the tintable hanger illustrations used in the grid
- `js/app.js` — filters, quick view, bag drawer, simulated checkout, search, wishlist (bag and wishlist persist in `localStorage`)
- `vendor/` — Three.js r160 (self-hosted), `fonts/` — self-hosted WOFF2

Checkout is a demo: no payment is taken and nothing is sent anywhere.
Replace the illustrations with product photography by adding a `photo` path to a product in `products.js`.
