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
- **The shop is a boutique rail.** Each row of garments hangs from a chrome rail (the rail segments join across the grid), every card is an arch that swings on its hook as it scrolls into view, and the price is a hang tag on the photo (rust for sale prices). Name in italic serif with the category beneath. 2 per row on phones, 3 or 4 on larger screens, and a 1 per row view (toggle on desktop; on phones it follows the saved layout).
- **Sticky filter bar** with category chips that centre the active one, a sort control (a native picker on phones) and a clear "Showing 6 pieces in Dresses · Clear" line.
- **Phone dock**: a small floating glass pill (icons only; the current section opens into a labelled pill, with live counts on Saved and Bag) replaces the header icons on small screens. It turns dark glass over the hero and slides away while you scroll down, returning when you scroll up. The header floats transparently over the hero photo, so the reel uses the full screen, and turns solid after the hero; a back-to-top button appears after the hero.
- **Quick view is a bottom sheet on phones**: big tap targets, a sticky "Select a size" / "Add to bag" button that shakes the size row if you forget, your last size remembered and preselected, a PIN-code delivery check, and short return/COD/shipping promises. The colour dots were removed because they did not change the photo; it now says which colour is shown and which others exist.
- **Bag**: removing an item offers Undo (the toast now sits above open drawers).
- **Search** opens with recent and popular searches and trending pieces.
- **Intro** is a hang tag swinging on a chrome rail that counts up to 100% with a stitch line filling beneath it; the tag then drops and the two sand-coloured boutique doors swing apart onto the page. It plays once per visit instead of on every page load; inputs are 16px (no iOS zoom); focus rings and 44px touch targets throughout.
