# Whiteberry

Boutique site for **Whiteberry** — traditional half sarees, pavadai sets and designer blouses.
*Elegance in every stitch.*

Static, no build step: `index.html`, `style.css`, `app.js`, `img/`.
Asset paths are absolute (`/whiteberry/...`), so serve from the repo root:

```bash
python3 -m http.server 8080   # then open http://localhost:8080/whiteberry/
```

## Design notes
- Palette comes from the garments: ivory, maroon zari-check, antique gold, olive, mint, navy.
- Motifs: temple-arch photo frames, scalloped edges (blouse necklines), gold zari triangle border,
  and a running stitch with three blossoms (the logo's idea, reworked).
- Motion: stitch-sewing intro, word-by-word headline reveals, falling petals & sparkles,
  mouse-parallax arches, scroll-drawn stitch line, marquee, 3D card tilt, colour filter,
  cursor-following preview, magnetic buttons. All of it respects `prefers-reduced-motion`.

## To finish
Fill in `CONFIG` at the top of `app.js` (WhatsApp number, Instagram handle, email, address).
Until then the enquiry form shows a "connect WhatsApp" note and the contact list is hidden.
Product names/descriptions in `index.html` are placeholders written from the photos.
