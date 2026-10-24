# SV Caterers — website

Catering website for the SV Fashions client's **catering service** — traditional Tamil Nadu / South Indian feasts served on a banana leaf, Coimbatore.
Not e-commerce: people browse, then plan their function on WhatsApp (+91 91500 99500). Built by Dotnapps.

Static site, no build step. Preview: `python3 -m http.server 8080` in this folder.
Deploy: Vercel → new project from this repo, **Root Directory = `sv-caterers`**, preset *Other*, no build command
(Cloudflare Pages: build output directory = `sv-caterers`).

## Files
- `index.html` — the page (generated once from `index.template.html`; edit `index.html` directly from now on and ignore the template).
- `styles.css`, `script.js` — calm white + warm cream design with green as an accent (buttons, details, footer). **One** banana leaf (hero, plus the preloader and logo); no other leaf decoration. Tabs, gallery viewer, WhatsApp form, bottom order bar on phones.
- `assets/logo-mark.svg` — **placeholder logo** (white banana leaf on deep green). Replace with the client's real logo when they share it.
- `assets/img/plate.svg` — shown if a photo fails to load.

## Check with the client before launch
1. **Business name** — "SV Caterers" is a working title. The client's own reels show a "CATERERS" logo; get the real name/logo.
2. **Phone / WhatsApp** — `919150099500` is reused from the fashion site. Search for it in `index.html` and `script.js` (`CONFIG.whatsapp`).
3. **Menu** — the dish lists are typical Tamil Nadu items (idli, ven pongal, kal dosai, sambar, rasam, kootu, poriyal, kuzhambu, payasam, mysore pak, adhirasam…). Confirm what they really serve, and whether they cater non-veg.
4. **Events** — Weddings, gruhapravesam, seemantham / family functions, corporate, temple & festival annadhanam. Confirm.
5. **Tamil text** — the small Tamil accents (வாழை இலை விருந்து, தரம் · அளவு · சுத்தம், டிபன், சாப்பாடு, இனிப்பு) are mine; have a native speaker check them.
6. **Photos** — free [Pexels](https://www.pexels.com) stock photos, hotlinked: 9266190, 32229637, 5560763 (hero) · 8312083, 5410418, 19151502 (menu) ·
   7234281, 33932441, 30685770, 17878224, 35407778, 5560763 (gallery). Open `https://www.pexels.com/photo/<id>/` for photographer and licence.
   They are stock, not the caterer's own food — replace with real photos (`src` + `alt` in `index.html`).
7. Add a real address / map and opening details if wanted; set an absolute `og:image` URL once the domain is known.

## Deploy status
Deployed on Vercel as project `sv-caterers` (Root Directory `sv-caterers`, production branch `claude/fervent-goldberg-sbbkkm`).
