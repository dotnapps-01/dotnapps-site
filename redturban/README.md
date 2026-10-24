# The Red Turban — event management site

Static, dependency-free site (HTML + CSS + vanilla JS). Preview:

```bash
cd redturban && python3 -m http.server 8080   # http://localhost:8080
```

## Brand read from the logo
A red turban (safa) crowning a red Devanagari **ट** that stands in for the "T" of *Turban*, set in a black classic serif.
The design idea is *the host is crowned*: turban red `#E4152C`, ink, warm ivory paper, a thin gold line from jali work,
and the turban + ट reused as the hero stage, intro animation, wordmark and footer lockup.
`assets/turban.png` and `assets/ta.png` are cut from the supplied logo (`assets/logo-original.webp`).

## Features
- Brand intro (turban settles onto the ट), parallax hero, scroll-reveal, reading-progress bar
- **Budget estimator** — live range, per-guest figure and cost breakdown
- **Planning timeline** — countdown checklist from the event date, saved on-device, exports a `.ics` calendar
- **Concept gallery** — filters, lightbox with prev/next, "plan something like this" pre-fills the enquiry
- **Enquiry wizard** — 4 steps with validation; all tools share one saved brief; send via WhatsApp / email / copy / download
- Light + night theme, English / தமிழ் toggle (marketing copy), mobile menu + sticky action bar
- Accessible: skip link, keyboard-operable tabs/dialog, `prefers-reduced-motion`, semantic landmarks

## Before launch — fill these in
| What | Where |
|---|---|
| WhatsApp number / email for enquiries | `CONFIG` at top of `app.js` |
| Real rate card (current figures are **samples**) | `RATES` in `app.js` |
| Real event photos (concepts are illustrative art) | add `img: 'assets/…'` to an item in `EXPERIENCES` |
| Phone, address, social links, verified service area | `index.html` (footer / reach section) and JSON-LD |
| Package names/inclusions, FAQ answers | `index.html` (draft copy) |
