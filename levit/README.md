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
- **Hero: photo trail.** A huge LEVIT on white with a soft glow that follows the pointer. Moving the mouse (or a finger) leaves a trail of your real photos that pop in at a slight tilt, drift along the direction of travel and fade; hover one to hold it, click to open the product. When nobody is moving a pointer a ghost cursor wanders so the hero is never still. Reduced motion shows a static scatter instead. It is the `hero()` block in `js/app.js`, drawing from every product that has a photo.
- `js/products.js` — the catalogue (INR), every product with a real photo; `js/garments.js` holds the small hanger drawing used only on the empty-bag and order-confirmed screens
- `js/app.js` — filters, quick view, bag drawer, simulated checkout, search, wishlist (bag and wishlist persist in `localStorage`)
- `fonts/` — self-hosted WOFF2

Checkout is a demo: no payment is taken and nothing is sent anywhere.
To add a piece: drop its photo in `img/p/` and add an entry with a `photo` path to `products.js`.
