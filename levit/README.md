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
- **Hero styles to try (14).** The hero is built by `js/heroes/` and styled in `css/heroes.css` (the magazine's CSS is in `levit.css`). The dock on the left edge of the page (a small pill at the bottom right on phones) switches between them; `?hero=3` or Alt+1..9 also work, and the choice is remembered. Once you pick one, delete the dock (`js/heroes/index.js`) and the other modules.
  1. **Sand curtain**: LEVIT is printed across two curtain halves that part as you scroll, onto a look and the headline.
  2. **Runway scroll**: the hero pins while the looks walk across a huge LEVIT; the one nearest the middle steps forward.
  3. **Wordmark windows**: each letter of LEVIT is a window on its own slow cycle of photos; hover to hold one, click to open it.
  4. **Magazine cover**: a 3D page turn between 8 covers, with an Inside this issue list.
  5. **Clothes rail**: photos hang from hangers on a brass rail; drag it and they swing like pendulums.
  6. **Fly through**: photos in a corridor, the camera drifting forward; wheel, drag or mouse height changes the speed.
  7. **Story reel**: a phone frame with progress bars, tap or hold, and highlight rings.
  8. **Draggable prints**: prints on a tabletop to pick up, throw and shuffle.
  9. **Venetian blinds**: a tall arched frame of nine slats that flip one after another to the next look.
  10. **Bento grid**: photo tiles that each change on their own beat, beside a colour block and a shop tile.
  11. **Spotlight**: the looks sit in the dark; move the light to reveal them (it wanders by itself when idle).
  12. **Cylinder**: the looks stand on a slowly turning 3D ring; drag to spin it.
  13. **Photo booth**: a machine prints strips of four looks that drop onto the table; press the button for another.
  14. **Collage**: a big editorial headline with taped photos at different depths that shift with the mouse.
- `js/products.js` — the catalogue (INR), every product with a real photo; `js/garments.js` holds the small hanger drawing used only on the empty-bag and order-confirmed screens
- `js/app.js` — filters, quick view, bag drawer, simulated checkout, search, wishlist (bag and wishlist persist in `localStorage`)
- `fonts/` — self-hosted WOFF2

Checkout is a demo: no payment is taken and nothing is sent anywhere.
To add a piece: drop its photo in `img/p/` and add an entry with a `photo` path to `products.js`.
