# Browser tests

Playwright + axe-core, one script per build phase. They drive the real app in a browser: sign up, build things, scan as a
customer on a phone-sized screen in English, Tamil and Hindi, run an accessibility check on every screen, and check there is
no horizontal scroll at 360 px.

```bash
npx playwright install chromium          # once
ADMIN_PHONES=+919000000001 ADMIN_PHONE=9000000001 WEBHOOK_ALLOW_PRIVATE=1 npm run dev
npm run e2e                              # all phases (about 10 minutes)
ONLY=phase8 npm run e2e                  # one phase
```

`npm run test:all` starts its own server and runs these plus every API suite, which is what CI does.

Screenshots and downloads go to `e2e/out/` (git-ignored). A failing step also saves screenshots of every open page.
Phase 3 waits out the 30-second resend cooldown for its test number, so it takes a while.
