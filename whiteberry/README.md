# Whiteberry

Boutique site for **Whiteberry** — half sarees, pavadai sets, anarkalis with kalamkari dupattas and kurta sets.
*Elegance in every stitch.*

Static, no build step: `index.html`, `style.css`, `app.js`, `img/`.
Asset paths are relative, so the folder is self-contained:

```bash
cd whiteberry && python3 -m http.server 8080   # open http://localhost:8080
```

## Deploy on Vercel
Import the repo, set **Root Directory** to `whiteberry`, Framework Preset **Other**, leave build/output empty. Config is in `vercel.json`.

## Design notes
- Quiet-luxury editorial: warm ivory, deep navy `#0E1546`, champagne-gold hairlines. The logo's royal blue
  `#142194` is used sparingly (italic accents, hover states) and its pink `#D05C86` dot sits in the blossoms.
  The dresses' own colours are left to the photos. The logo is rebuilt as a non-round lockup (stitch + three blossoms, name, tagline, stitch) in CSS/HTML — no image file.
- Type: Cormorant Garamond (light, large) + Jost (small tracked caps).
- Signature motif: a gold running stitch with three blossoms (the logo's idea, reworked) used in the intro,
  statement and footer. Temple-arch frames appear only on the hero and the collections stage.
- Motion (all off under `prefers-reduced-motion`): intro veil, image curtains that lift, words that rise,
  a statement whose words brighten as you scroll, collections list that drives one large photograph
  (auto-advances), type + colour filter on the lookbook, a stitch line that draws across the atelier steps,
  cursor-following photo on the occasions list, gentle parallax.

## To finish
Fill in `CONFIG` at the top of `app.js` (WhatsApp number, Instagram handle, email, address).
Until then the enquiry form shows a "connect WhatsApp" note and the contact list is hidden.
Piece names/descriptions are generated placeholders written from the photos — edit them in `index.html`.
The enquiry form's piece list is built from the lookbook cards automatically.
