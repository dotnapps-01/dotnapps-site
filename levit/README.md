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
- **Hero: swipe-up reel.** Only the hero is a reel; the rest of the page is the normal shop. The headline changes with each look ("Dressed in deep red.", "Tied up, never tied down." ...; the lines are in the `HEAD` map in `js/heroes/reel.js`) and returns to "Soft structure, every day." on the last panel. Each of eight real looks fills the frame and you swipe up (or scroll) for the next, with the price and Shop this look under your thumb, a heart that saves to the wishlist, a progress rail, a Swipe up cue, and a Skip to shop pill. The last panel hands the visitor on to the collection. On desktop the reel is a phone-width column with the headline beside it over a blurred copy of the current photo. Code: `js/heroes/reel.js` (looks listed in `LOOK_IDS` in `js/heroes/util.js`), styles in `css/heroes.css`. The other hero styles tried are in git history.
- `js/products.js` — the catalogue (INR), every product with a real photo; `js/garments.js` holds the small hanger drawing used only on the empty-bag and order-confirmed screens
- `js/app.js` — filters, quick view, bag drawer, simulated checkout, search, wishlist (bag and wishlist persist in `localStorage`)
- `fonts/` — self-hosted WOFF2

Checkout is a demo: no payment is taken and nothing is sent anywhere.
To add a piece: drop its photo in `img/p/` and add an entry with a `photo` path to `products.js`.


## Shop design and ease of use
- **The shop is a clean gallery.** Plain rectangular photos with soft corners, then the name on the left and the price on the right (sale prices in rust with the old price struck through), and a tiny New/Bestseller label on the photo. On desktop the heart and a row of size buttons slide in on hover for one-click adds; on phones you just tap the photo (a small heart stays on the corner). 2 per row on phones, 3 or 4 on larger screens, and a 1 per row view.
- **Sticky filter bar** with category chips that centre the active one, a sort control (a native picker on phones) and a clear "Showing 6 pieces in Dresses · Clear" line.
- **Phone dock**: a small floating glass pill (icons only; the current section opens into a labelled pill, with live counts on Saved and Bag) replaces the header icons on small screens. It turns dark glass over the hero and slides away while you scroll down, returning when you scroll up. The header floats transparently over the hero photo, so the reel uses the full screen, and turns solid after the hero; a back-to-top button appears after the hero.
- **Quick view is a bottom sheet on phones**: big tap targets, a sticky "Select a size" / "Add to bag" button that shakes the size row if you forget, your last size remembered and preselected, a PIN-code delivery check, and short return/COD/shipping promises. The colour dots were removed because they did not change the photo; it now says which colour is shown and which others exist.
- **Bag**: removing an item offers Undo (the toast now sits above open drawers).
- **Search** opens with recent and popular searches and trending pieces.
- **Intro**: on a dark screen, real photos flash through an arch while a huge serif counter climbs 0 to 100%; at 100% the arch lands on the first look and grows until it fills the screen, then dissolves into the page. It plays once per visit (and is skipped for reduced motion); the photos in `index.html` (`#pl-photos`) are the same ones the hero uses, so it doubles as a preload.
