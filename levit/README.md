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
- **Hero: the magazine cover.** The hero is a cover of the LEVIT AW26 issue: a giant LEVIT masthead over a real photo, cover lines, the look's name with a Shop inside button, a barcode and a folded corner, standing on a warm desk with a stack of pages behind it. Turning the page flips the cover around its spine (a real 3D page turn) to the next of 8 looks. Use the Turn the page link, click or swipe the cover, or pick a look from the Inside this issue list. It turns by itself every few seconds, pauses on hover, and with reduced motion just swaps. The looks and the light/dark masthead tone for each photo are in the `hero()` block of `js/app.js`.
- `js/products.js` — the catalogue (INR), every product with a real photo; `js/garments.js` holds the small hanger drawing used only on the empty-bag and order-confirmed screens
- `js/app.js` — filters, quick view, bag drawer, simulated checkout, search, wishlist (bag and wishlist persist in `localStorage`)
- `fonts/` — self-hosted WOFF2

Checkout is a demo: no payment is taken and nothing is sent anywhere.
To add a piece: drop its photo in `img/p/` and add an entry with a `photo` path to `products.js`.
