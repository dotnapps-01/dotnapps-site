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
- **Hero: colour-block lookbook.** A white hero with a short headline and five tall coloured arches (black, lilac, rust, sage, camel), each holding one look: your photos, or a hanger illustration of a shop product. The active arch opens wide and shows its name, price and a Shop button (quick view); the others fold into slim strips with a vertical label. It advances on its own with a thin progress line, pauses on hover and when the tab is hidden, and any arch can be opened by hover, click or keyboard focus. Plain HTML/CSS plus a short script in `js/app.js` (the `hero()` block); change the looks by editing the `.lb__p` articles in `index.html` (`data-id` is a product id).
- `js/garments.js` / `js/products.js` — catalogue (INR) and the tintable hanger illustrations used in the grid
- `js/app.js` — filters, quick view, bag drawer, simulated checkout, search, wishlist (bag and wishlist persist in `localStorage`)
- `fonts/` — self-hosted WOFF2

Checkout is a demo: no payment is taken and nothing is sent anywhere.
Replace the illustrations with product photography by adding a `photo` path to a product in `products.js`.
