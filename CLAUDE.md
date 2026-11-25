# Skanor — build brief for Claude Code

Skanor is a QR-based SaaS for Indian SMBs, by Dotnapps. It started as a Google-review assistant and now covers basic-to-advanced QR services. Every module follows one loop:

**QR → page/action → data → follow-up**

The finished UI/UX design for the whole product is in `design/`. Build the real product from it. Keep the layouts, copy, and theme as designed unless told otherwise.

## What's in `design/`

The `*.dc.html` files are design references exported from a Claude design canvas. They are not runnable on their own: they need a canvas runtime (`support.js`) that is not included.

Read them for:
- **Layout and styles:** the inline styles.
- **Sample data:** the `renderVals()` object inside the `<script type="text/x-dc">` block.
- **Markup:** loops are written as `sc-for` and conditions as `sc-if`, and `{{x}}` marks a data value. `<dc-import name="X">` embeds component `X`.

`canvas.json` lists every board, grouped by page.

| Group | Files |
|---|---|
| Marketing site | Main (home), Features, ModuleReviews (template for module pages), Industries, Pricing, Contact |
| Auth / onboarding | SignUp, Onboarding (5 steps: OTP → business type → goals → location + Google link → first QR live) |
| App (sidebar layout) | Dashboard, QRStudio, QRLibrary, Analytics, Reviews, Leads, Offers, Pages, Tickets, Attendance, Bookings, RealEstate, Products, Integrations, Settings, AdminConsole (Skanor internal) |
| Customer scan pages (mobile, 390×844) | ScanReviews, ScanEngage, ScanOps, ScanProduct. Each file holds 4–6 phone screens side by side. |
| Shared components | SiteNav, SiteFooter, AppSidebar, QRMark (generated QR art: square / dot / halftone) |
| Design system | StyleGuide |

## Design tokens (Nexo-style theme)

- **Colours**
  - Ink `#0E0E10` for headlines, primary buttons, and active states
  - Graphite `#3D3D45` for body text; Muted `#6B6B75` for labels
  - Line `#E7E7EB` / `#F1F1F3` for borders; page `#FAFAFA`; surface `#FFFFFF`
- **No blue accents.** Use black. Lilac is used only for "info" status and soft fills.
- **Status pills (background / text)**
  - Success `#E3F2EA` / `#1F6B45`
  - Warning `#FDF0E1` / `#8A4A06`
  - Danger `#FBE4E1` / `#A8321F`
  - Info `#F3EEFF` / `#5B45B8`
- **Marble gradient** for hero frames, plan cards, and scan-page headers:
  `background-color:#EEF2FF; background-image: radial-gradient(55% 60% at 12% 18%, #AFCBFF 0%, transparent 70%), radial-gradient(45% 55% at 88% 22%, #F6B8DA 0%, transparent 70%), radial-gradient(55% 60% at 72% 88%, #CDBDFF 0%, transparent 70%), radial-gradient(45% 50% at 18% 90%, #F8C6D6 0%, transparent 70%)`.
  Use at most one marble area per screen.
- **Type:** Inter for body text. Inter Tight 600 for headings, with tight letter-spacing (−0.04 to −0.045em).
- **Shape**
  - Buttons are pills (radius 999). Primary = black fill, white text; secondary = white with a 1px ink border.
  - Card radius 16, input radius 12, phone/hero radius 24–28. Soft shadow: `0 20px 60px rgba(90,80,180,.18)`.
- **Badge:** grey pill with a small black "+ New" chip inside.

## Product rules (must keep)

- **Review flow must comply with Google's policy.** Every customer, at every star rating, sees "Post on Google". Low ratings also get a private-feedback form, but it is an extra choice, never a filter. No review gating.
- **Placeholders:** values like `[₹ PRICE]`, `[00]%`, `[Client logo]` and `[sales@skanor.in]` are unconfirmed. Keep them as placeholders until real values are provided.
- **Languages:** scan pages support English, Tamil, and Hindi.
- **Accessibility:** use real `<button>`/`<label>`, add `aria-label` on icon buttons, use inline SVG icons (no emoji icons), and keep pages responsive down to 360px.

## Suggested stack (change if the team prefers)

- Next.js (App Router) + TypeScript + Tailwind CSS, with the tokens above in `tailwind.config`
- Postgres (e.g. Supabase) with multi-tenant data: workspace → locations → QR codes → scans / leads / reviews …
- Short-link redirect service for QR codes (`skn.to/<code>`) that logs each scan, then redirects

## Build order

1. Tokens, UI primitives, SiteNav/SiteFooter, AppSidebar, and QRMark
2. Marketing site
3. Auth and onboarding
4. QR Studio, QR Library, the redirect service, and Analytics
5. Review Assistant: the Reviews app screen plus the ScanReviews pages
6. Leads, Offers/Loyalty, and Pages (menu, business card)
7. Tickets, Attendance/Visitors, Bookings, and Real estate
8. Product QR/warranty/authenticity, Integrations/API, Settings/billing, and the Admin console
