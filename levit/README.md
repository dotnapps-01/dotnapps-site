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
- **Hero: story reel.** The hero is an Instagram-style story of eight looks in a phone-shaped frame: segmented progress bars, a levit.womenswear header with a gradient avatar ring, a sticker with the look's name and price (tap to open the quick view), a heart that bursts, and a Shop this look pill. Tap the left or right side (or use the arrow keys) to move, hold to pause; round rings beside it jump to any look. It advances every five seconds and is static for reduced motion. It lives in `js/heroes/stories.js` with its styles in `css/heroes.css`; the looks are the eight in `LOOK_IDS` (`js/heroes/util.js`). Thirteen other hero styles were tried (curtain, runway, wordmark windows, magazine cover, clothes rail, fly-through, draggable prints, blinds, bento, spotlight, cylinder, photo booth, collage) and are in git history.
- `js/products.js` — the catalogue (INR), every product with a real photo; `js/garments.js` holds the small hanger drawing used only on the empty-bag and order-confirmed screens
- `js/app.js` — filters, quick view, bag drawer, simulated checkout, search, wishlist (bag and wishlist persist in `localStorage`)
- `fonts/` — self-hosted WOFF2

Checkout is a demo: no payment is taken and nothing is sent anywhere.
To add a piece: drop its photo in `img/p/` and add an entry with a `photo` path to `products.js`.
