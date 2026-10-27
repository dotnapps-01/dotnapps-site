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
- **Hero: swipe-up reel.** Only the hero is a reel; the rest of the page is the normal shop. Each of eight real looks fills the frame and you swipe up (or scroll) for the next, with the price and Shop this look under your thumb, a heart that saves to the wishlist, a progress rail, a Swipe up cue, and a Skip to shop pill. The last panel hands the visitor on to the collection. On desktop the reel is a phone-width column with the headline beside it over a blurred copy of the current photo. Code: `js/heroes/reel.js` (looks listed in `LOOK_IDS` in `js/heroes/util.js`), styles in `css/heroes.css`. The other hero styles tried are in git history.
- `js/products.js` — the catalogue (INR), every product with a real photo; `js/garments.js` holds the small hanger drawing used only on the empty-bag and order-confirmed screens
- `js/app.js` — filters, quick view, bag drawer, simulated checkout, search, wishlist (bag and wishlist persist in `localStorage`)
- `fonts/` — self-hosted WOFF2

Checkout is a demo: no payment is taken and nothing is sent anywhere.
To add a piece: drop its photo in `img/p/` and add an entry with a `photo` path to `products.js`.
