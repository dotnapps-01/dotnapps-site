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
- **Hero styles to try (phone-first, 9).** The control at the bottom of the page (a slim dock on desktop) switches between them; `?hero=3` and Alt+1..9 also work and the choice is remembered. Pick one, then delete the rest and `js/heroes/index.js`. Each lives in `js/heroes/<name>.js` with styles in `css/heroes.css`.
  1. **Swipe deck** (`deck.js`): swipe a look right to save it to the wishlist, left to skip; Love/Skip stamps fade in, buttons do the same.
  2. **Reel feed** (`reel.js`): each look fills the screen, swipe up for the next; heart, price and Shop sit under the thumb; ends on a Shop the edit panel.
  3. **Tilt to peek** (`tilt.js`): layers shift as you tilt the phone (asks permission on iPhone) or move the mouse; swipe for the next look.
  4. **Bottom sheet** (`sheet.js`): full-screen look with a sheet you drag up to pick a size and add to the bag without leaving the hero.
  5. **Scratch to reveal** (`scratch.js`): scratch a sand-coloured LEVIT card to reveal the look; a ghost finger shows how.
  6. **Look pins** (`pins.js`): tap pulsing dots on the photo to read the product details.
  7. **Flick stack** (`flick.js`): prints piled up; flick the top one away with its momentum.
  8. **Thumb dial** (`dial.js`): spin a dial at the bottom with your thumb to change the look.
  9. **Story reel** (`stories.js`): the Instagram-style reel.
  Earlier desktop-oriented styles (magazine, runway, windows, rail, etc.) are in git history.
- `js/products.js` — the catalogue (INR), every product with a real photo; `js/garments.js` holds the small hanger drawing used only on the empty-bag and order-confirmed screens
- `js/app.js` — filters, quick view, bag drawer, simulated checkout, search, wishlist (bag and wishlist persist in `localStorage`)
- `fonts/` — self-hosted WOFF2

Checkout is a demo: no payment is taken and nothing is sent anywhere.
To add a piece: drop its photo in `img/p/` and add an entry with a `photo` path to `products.js`.
