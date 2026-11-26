import type { Metadata } from "next";
import Link from "next/link";
import { WEBHOOK_EVENTS } from "@/lib/webhook-events";

export const metadata: Metadata = { title: "API docs", description: "The Skanor API and webhooks: create QR codes, generate product serials, look up scans, and get told when something happens." };

const H2 = "mb-3 mt-12 scroll-mt-24 font-display text-[28px] font-semibold tracking-sub";
const P = "m-0 mb-3 max-w-[70ch] text-[15.5px] leading-[1.7] text-graphite";
const CODE = "my-4 overflow-x-auto whitespace-pre rounded-input bg-ink p-4 font-mono text-[12.5px] leading-[1.7] text-line";
const IC = "rounded bg-mist px-1.5 py-0.5 font-mono text-[13px] text-ink";

function Endpoint({ method, path, children }: { method: string; path: string; children: React.ReactNode }) {
  return (
    <section aria-label={`${method} ${path}`} className="mb-5 rounded-card border border-line bg-white">
      <h3 className="m-0 flex flex-wrap items-center gap-2.5 border-b border-line-soft px-[18px] py-3 font-mono text-[14px] font-semibold">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] ${method === "GET" ? "bg-mist text-ink" : "bg-ink text-white"}`}>{method}</span>
        {path}
      </h3>
      <div className="px-[18px] py-3.5 text-[14.5px] leading-[1.65] text-graphite">{children}</div>
    </section>
  );
}

export default function DocsPage() {
  return (
    <article className="mx-auto max-w-[860px] px-5 py-14 sm:px-8">
      <div className="k">Developers</div>
      <h1 className="mb-3 mt-2 font-display text-[clamp(36px,6vw,56px)] font-semibold leading-none tracking-display">Skanor API</h1>
      <p className={P}>Create QR codes, generate serialized product codes, look up what happened to them, and get a signed message the moment a customer scans, rates, books or registers. API access is part of the Enterprise plan.</p>
      <nav aria-label="On this page" className="my-6 flex flex-wrap gap-2 text-sm">
        {["authentication", "qr", "products", "webhooks", "errors"].map((id) => (
          <a key={id} href={`#${id}`} className="rounded-full border border-line px-3.5 py-1.5 text-ink no-underline hover:bg-mist">
            {id[0].toUpperCase() + id.slice(1)}
          </a>
        ))}
      </nav>

      <h2 id="authentication" className={H2}>
        Authentication
      </h2>
      <p className={P}>
        Create a key under{" "}
        <Link href="/app/integrations?tab=api" className="font-semibold text-ink underline underline-offset-2">
          Integrations → API keys
        </Link>
        . It looks like <code className={IC}>sk_live_…</code> and is shown once, so store it safely. Send it on every request:
      </p>
      <pre tabIndex={0} className={CODE}>{`Authorization: Bearer sk_live_…`}</pre>
      <p className={P}>
        A key has one scope. <strong>Read only</strong> keys can use every GET endpoint. <strong>Create QR codes and batches</strong> (<code className={IC}>qr:write</code>) adds the POST endpoints. <strong>Everything</strong> (<code className={IC}>all</code>) covers the whole API. Revoking a key stops it at once.
      </p>
      <p className={P}>
        Each key may make 120 requests a minute; past that you get <code className={IC}>429</code> with <code className={IC}>retry_after</code>. All responses are JSON: <code className={IC}>{`{ "data": … }`}</code> on success.
      </p>

      <h2 id="qr" className={H2}>
        QR codes
      </h2>
      <Endpoint method="GET" path="/v1/qr">
        <p className="m-0">Your QR codes (not archived), up to 500, each with its short URL and scans in the last 30 days.</p>
      </Endpoint>
      <Endpoint method="GET" path="/v1/qr/{id}">
        <p className="m-0">One QR code. 404 if it isn&rsquo;t yours.</p>
      </Endpoint>
      <Endpoint method="POST" path="/v1/qr">
        <p className="m-0 mb-2">Creates a QR code with the same fields as the app: <code className={IC}>name</code>, <code className={IC}>type</code>, <code className={IC}>config</code>, and optionally <code className={IC}>dynamic</code> and <code className={IC}>publish</code> (false saves a draft). Needs <code className={IC}>qr:write</code>.</p>
        <pre tabIndex={0} className={CODE}>{`curl https://YOUR-DOMAIN/v1/qr \\
  -H "Authorization: Bearer sk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Table 4 menu", "type": "url",
        "config": { "url": "https://example.com/menu" },
        "publish": true }'

# 201
{ "data": { "id": "…", "status": "active",
            "short_code": "k3x9qw2", "short_url": "https://YOUR-DOMAIN/q/k3x9qw2" } }`}</pre>
        <p className="m-0">Invalid fields come back as <code className={IC}>422</code> with a <code className={IC}>fields</code> object. A full plan returns <code className={IC}>403 plan_limit</code>.</p>
      </Endpoint>

      <h2 id="products" className={H2}>
        Serialized products
      </h2>
      <p className={P}>Create the product in the app (Products → Add product), then generate its codes by API. Each serial gets its own secret URL, so one serial can&rsquo;t be guessed from another. Print the URL as the QR code.</p>
      <Endpoint method="POST" path="/v1/batches">
        <p className="m-0 mb-2">Generates up to 20,000 codes. Body: <code className={IC}>product_id</code>, <code className={IC}>quantity</code>, <code className={IC}>prefix</code> (like <code className={IC}>AQ-26-</code>), optional <code className={IC}>warranty_months</code> and <code className={IC}>format</code>. Numbering continues after the highest serial already used with that prefix. Needs <code className={IC}>qr:write</code>.</p>
        <pre tabIndex={0} className={CODE}>{`{ "data": { "id": "…", "label": "B-07", "quantity": 5000,
            "first_serial": "AQ-26-000001", "last_serial": "AQ-26-005000",
            "codes": [ { "serial": "AQ-26-000001",
                         "url": "https://YOUR-DOMAIN/p/9f2c41d0a7b35e68" }, … ] } }`}</pre>
      </Endpoint>
      <Endpoint method="GET" path="/v1/codes/{serial}">
        <p className="m-0 mb-2">What is known about one serial: how often it has been scanned, whether a buyer has activated it, the warranty, and whether it has been flagged as suspicious.</p>
        <pre tabIndex={0} className={CODE}>{`{ "data": { "serial": "AQ-26-000123", "product": "AquaPure RO 8L", "batch": "B-07",
            "scan_count": 3, "activated": true, "first_scan_at": "2026-11-02T09:14:00Z",
            "flagged": false, "warranty": { "status": "verified", "valid_until": "2027-11-20" } } }`}</pre>
      </Endpoint>

      <h2 id="webhooks" className={H2}>
        Webhooks
      </h2>
      <p className={P}>
        Add an endpoint under Integrations → Webhooks and choose the events you want. Endpoints must be <code className={IC}>https</code> and reachable from the internet (private and internal addresses are refused, and redirects are not followed). We <code className={IC}>POST</code> JSON and expect any <code className={IC}>2xx</code> within 5 seconds; a failed delivery is tried once more straight away.
      </p>
      <ul className="mb-4 flex list-none flex-col gap-1.5 p-0">
        {WEBHOOK_EVENTS.map((e) => (
          <li key={e.key} className="flex flex-wrap gap-x-3 text-[14.5px]">
            <code className={IC}>{e.key}</code>
            <span className="text-graphite">{e.label}</span>
          </li>
        ))}
      </ul>
      <pre tabIndex={0} className={CODE}>{`POST https://example.com/hooks/skanor
Skanor-Event: lead.created
Skanor-Delivery: 7d1c…            (unique id; the same event is never sent under two ids)
Skanor-Signature: t=1764150000,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd

{ "id": "7d1c…", "type": "lead.created", "created_at": "2026-11-26T10:00:00.000Z",
  "data": { "lead_id": "…", "name": "Karthik R.", "interest": "Braces" } }`}</pre>
      <h3 className="mb-2 mt-6 font-sans text-[17px] font-semibold">Check the signature</h3>
      <p className={P}>
        <code className={IC}>v1</code> is the hex HMAC-SHA256 of <code className={IC}>{`"<t>.<raw body>"`}</code> using your endpoint&rsquo;s signing secret (<code className={IC}>whsec_…</code>, shown once when you add it). Compute it on the raw bytes, compare in constant time, and reject timestamps older than a few minutes.
      </p>
      <pre tabIndex={0} className={CODE}>{`import { createHmac, timingSafeEqual } from "node:crypto";

function verify(rawBody, header, secret) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  return v1.length === expected.length && timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}`}</pre>

      <h2 id="errors" className={H2}>
        Errors
      </h2>
      <pre tabIndex={0} className={CODE}>{`{ "error": { "code": "insufficient_scope", "message": "This key is read-only. …" } }`}</pre>
      <div className="overflow-x-auto rounded-card border border-line bg-white">
        <table className="w-full border-collapse text-left text-[14px]">
          <caption className="sr-only">Error codes</caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-line-soft bg-thead px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.02em] text-muted">
                Status
              </th>
              <th scope="col" className="border-b border-line-soft bg-thead px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.02em] text-muted">
                Code
              </th>
              <th scope="col" className="border-b border-line-soft bg-thead px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.02em] text-muted">
                Meaning
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              ["401", "unauthorized", "No key, a wrong key, or a revoked key."],
              ["403", "insufficient_scope", "The key can't do this (a read-only key on a POST)."],
              ["403", "plan_required", "API access is part of the Enterprise plan."],
              ["403", "suspended", "The account is not active."],
              ["404", "not_found", "No such item in your workspace."],
              ["422", "invalid", "A field is wrong. See `fields`."],
              ["429", "rate_limited", "More than 120 requests a minute on one key."],
            ].map(([s, c, m]) => (
              <tr key={c + s}>
                <td className="tabular border-b border-line-soft px-4 py-2.5">{s}</td>
                <td className="border-b border-line-soft px-4 py-2.5 font-mono text-[13px]">{c}</td>
                <td className="border-b border-line-soft px-4 py-2.5 text-graphite">{m}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
