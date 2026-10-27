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
- **Hero: the rack, model only (white).** `models/rack.glb` is a five-garment clothing rack (black shirt, taupe wrap dress, burgundy tunic, navy floral dress, blush floral shirt) on wooden hangers, with a baked breeze animation. `js/hero-rack.js` renders it with Three.js in a procedural photo-studio environment (softbox reflections on the brass hooks and steel rail), adds a fine weave normal map to plain fabrics and a varnish layer to the hangers, and drops contact-hardening (PCSS) shadows plus a soft contact shadow on the floor. Every hanger sits in a wrapper that swings as a damped pendulum, so hovering, dragging and scrolling move the real hangers while the baked animation keeps the fabric alive. The camera dollies in on load, shifts slightly with the pointer, and on phones drifts along the rail. Hotspot dots follow each garment and open its quick view. Without WebGL a transparent poster (`img/rack-poster.webp`, made with `__levitHero.snapshot()`) stands in.
- The glTF was compressed from 11 MB to 3.4 MB with `@gltf-transform/cli` (`dedup`, `resize 1024`, `webp`, `quantize`); keep those steps when you replace the model. Hanger pivot nodes must be named `<garment> hanger pivot`, and `PRODUCTS` in `hero-rack.js` maps each to a shop product.
- `vendor/` — Three.js r160 plus the glTF loader (self-hosted, loaded through the import map in `index.html`).
- `extras/hero-variants/` — earlier hero experiments, kept and not loaded: the dress-on-a-rail shader (`hero-hang.js`), the knit wordmark (`hero-wordmark.js`), the cloth-simulated rack (`hero3d.js`) and floating garments (`hero-float.js`), with the cloth solver, patterns and fabrics they share. The Three.js ones import from the live `vendor/`.
- `js/garments.js` / `js/products.js` — catalogue (INR) and the tintable hanger illustrations used in the grid
- `js/app.js` — filters, quick view, bag drawer, simulated checkout, search, wishlist (bag and wishlist persist in `localStorage`)
- `fonts/` — self-hosted WOFF2

Checkout is a demo: no payment is taken and nothing is sent anywhere.
Replace the illustrations with product photography by adding a `photo` path to a product in `products.js`.
