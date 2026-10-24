# SV Caterers — website

Catering website for the SV Fashions client's **catering service** — traditional Tamil Nadu / South Indian feasts served on a banana leaf, Coimbatore.
Not e-commerce: people browse, then **book a date** (step-by-step form + calendar) which arrives as a WhatsApp message (+91 91500 99500). Built by Dotnapps.

Static site, no build step. Preview: `python3 -m http.server 8080` in this folder.
Deploy: Vercel → new project from this repo, **Root Directory = `sv-caterers`**, preset *Other*, no build command
(Cloudflare Pages: build output directory = `sv-caterers`).

## Files
- `index.html` — the page (edit it directly).
- `styles.css`, `script.js` — calm white + warm cream design with green as an accent (buttons, details, footer). **One** banana leaf (hero, plus the preloader and logo); no other leaf decoration. Tabs, gallery viewer, WhatsApp form, bottom order bar on phones.
- `assets/logo-mark.svg` — **placeholder logo**: an "SV" monogram (drawn from the site's serif font) in a green ring. Replace with the client's real logo when they share it. Replace with the client's real logo when they share it.
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

## Booking system — what it does and doesn't do
The **Book a date** section is a 5-step form (occasion → date + meals on a calendar → guests + menu → name / mobile / venue → review).
It validates each step, makes a reference like `SVC-261024-B38L`, opens WhatsApp with every detail written out, and shows a confirmation screen.
A **Quick question** tab sends a short message to WhatsApp.

It is **a request, not a confirmed reservation**: nothing is stored on a server unless you turn on the Google Sheet option below, and the calendar
does not know the caterer's real diary. The date is confirmed when the caterer replies on WhatsApp. No payment is taken.

Settings are at the top of `script.js` (`CONFIG`):
- `blockedDates: ['2026-12-05', ...]` — dates already full; they show struck-through and can't be picked. Update when the diary fills up.
- `leadDays` (default 1) — earliest bookable date is today + this many days. `minGuests` (default 10). `monthsAhead` (default 12).
- `bookingEndpoint` — optional. Paste a Google Apps Script web-app URL and every booking is also saved as a row in a Google Sheet.

### Save bookings to a Google Sheet (free, ~5 minutes)
1. Create a Google Sheet. **Extensions → Apps Script**, paste:
```js
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Bookings') || ss.insertSheet('Bookings');
  if (sh.getLastRow() === 0) sh.appendRow(['Received', 'Ref', 'Function', 'Date', 'Meals', 'Guests', 'Menu', 'Add-ons', 'Venue/area', 'Name', 'Phone', 'Notes']);
  sh.appendRow([new Date(), data.ref, data.event, data.date, data.meals.join(', '), data.guests, data.menu, data.sweets.join(', '), data.area, data.name, data.phone, data.notes]);
  // MailApp.sendEmail('owner@example.com', 'New booking ' + data.ref, JSON.stringify(data, null, 2));  // optional email alert
  return ContentService.createTextOutput('ok');
}
```
2. **Deploy → New deployment → Web app**, *Execute as: Me*, *Who has access: Anyone*. Copy the URL.
3. Put it in `CONFIG.bookingEndpoint`. (The page sends the booking and cannot read the reply, so it always shows the confirmation and relies on the WhatsApp message as the main record.)

A real booking system (live availability, accounts, deposits) needs a backend and a database; ask Dotnapps if the client wants that later.
