# Whiteberry

Boutique site for **Whiteberry** — half sarees, pavadai sets, anarkalis with kalamkari dupattas and kurta sets.
*Elegance in every stitch.*

Static, no build step: `index.html`, `style.css`, `app.js`, `img/`.
Asset paths are absolute (`/whiteberry/...`), so serve from the repo root:

```bash
python3 -m http.server 8080   # then open http://localhost:8080/whiteberry/
```

## Design notes
- Palette is the logo's: royal blue `#142194`, butter yellow `#F7E271`, white blossoms with a pink `#D05C86` eye,
  on crisp white. The dresses' own colours are left to the photos. Real logo roundel is `img/logo.png`.
- Motifs: temple-arch photo frames, scalloped edges (blouse necklines), gold zari triangle border,
  and a running stitch with three blossoms (the logo's idea, reworked).
- Motion: stitch-sewing intro, word-by-word headline reveals, falling petals & sparkles,
  mouse-parallax arches, scroll-drawn stitch line, marquee, 3D card tilt, colour filter,
  cursor-following preview, magnetic buttons, type + colour filter on the lookbook. All of it respects `prefers-reduced-motion`.

## To finish
Fill in `CONFIG` at the top of `app.js` (WhatsApp number, Instagram handle, email, address).
Until then the enquiry form shows a "connect WhatsApp" note and the contact list is hidden.
Piece names/descriptions are generated placeholders written from the photos — edit them in `index.html`.
The enquiry form's piece list is built from the lookbook cards automatically.
