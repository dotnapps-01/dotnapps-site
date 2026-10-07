# Dotnapps staff apps

Internal apps for Dotnapps staff, built in divisions and shipped one division at a time.

| Division | Apps | Status |
|---|---|---|
| **Deal Desk** (Sales & Finance) | CRM, Quotations & Invoices, Contracts | Released |
| HR | HRM, Recruitment, Leave & Attendance, Payroll, Timesheets, Performance | Built, held back |
| Work | Tasks, Chat, Calendar, Documents, Knowledge Base | Built, held back |

To release a division, set `released: true` in `DIVISIONS` in `shell.js` and add its links to `index.html`.
Rename a division by editing its `name` there.

Each app is its own page (`/staff/<app>/`), with no combined dashboard.
`/staff/` is only a plain list of links to released apps.

## CRM
Rebuilt from the earlier Dotnapps CRM (`dotnapps-01/dotnapps-crm`): Leads, Contacts, Companies,
Deals (pipeline board) and Tasks, with an activity timeline on every record, tags, GSTIN and
addresses on companies, and lead conversion (contact + company + deal, same-name companies reused).
Not carried over yet: bulk actions, CSV import, multiple pipelines/stage editor, automation rules,
notifications, reports. Quotations come from Deal Desk's own Quotations & Invoices app.

## How it works
- `core.js` shared store, forms and record engine · `apps.js` / `special.js` app definitions
- `shell.js` per-app header, sign-in switcher, data tools · `<app>/index.html` sets `data-app`
- No build step. Preview: `python3 -m http.server 8080` then open `/staff/hrm/`.

## Limits (until connected to the Business OS backend)
- Data is stored in the browser (`localStorage`) only; it is not shared between staff computers.
- "Signed in as" is a demo switcher, not authentication. Role rules are cosmetic here and
  must be enforced server-side. Do not enter real salaries or personal data yet.
- Payroll is an estimate (no TDS/ESI); verify with an accountant.
