# Skanor app (Phase 1)

Next.js (App Router) + TypeScript + Tailwind 3.4. Design references live in `../design`, the brief in `../CLAUDE.md`.

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build && npm start
```

- `/styleguide` — design system, built from the real components
- `/`, `/features`, `/features/review-assistant`, `/industries`, `/pricing`, `/contact` — marketing site (Phase 2). Copy and sample data live in `lib/content/`, sections in `components/marketing/`
- `/docs` — placeholder until the Integrations/API screen (Phase 8)
- `/app/dashboard` and the other `/app/*` routes — app shell with sidebar (placeholders until Phases 4–8)

Tokens: `tailwind.config.ts` (colours, status pills, radii, shadow, `bg-marble`) and `app/globals.css`.
Primitives: `components/ui`. Shared: `components/site`, `components/app`, `components/qr/QRMark.tsx`.

`npm run check:qr` decodes the three QR styles on `/styleguide` with ZXing (needs a running server and Playwright).

## Book-a-demo form

`/contact` posts to `/api/demo-request`. Set `DEMO_REQUEST_WEBHOOK_URL` (see `.env.example`) to forward submissions as JSON to Zapier, Make, a CRM, etc. With no webhook set, the API returns 503 and the form says it isn't connected yet instead of pretending to send.
