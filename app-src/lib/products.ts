import "server-only";
import { query, tx } from "@/lib/db";
import { upsertContact } from "@/lib/engage";
import { istDay } from "@/lib/ops-input";
import type { BatchFormat, BatchInput, ProductInput, ServiceRequestInput, WarrantyInput } from "@/lib/product-input";
import { serialOf } from "@/lib/product-input";
import { createTicket } from "@/lib/tickets";
import { emitEvent } from "@/lib/webhooks";

const uuidRe = /^[0-9a-f-]{36}$/i;
const isUuid = (v: string) => uuidRe.test(v);

/* =====================================================================
 * Products
 * ===================================================================== */

export type ProductRecord = { id: string; name: string; model: string; madeIn: string; warrantyMonths: number; manualUrl: string; videosUrl: string; buyUrl: string; serviceEnabled: boolean; batches: number; codes: number };
type ProductRow = { id: string; name: string; model: string; made_in: string; warranty_months: number; manual_url: string; videos_url: string; buy_url: string; service_enabled: boolean; batches: number; codes: number };
const toProduct = (r: ProductRow): ProductRecord => ({ id: r.id, name: r.name, model: r.model, madeIn: r.made_in, warrantyMonths: r.warranty_months, manualUrl: r.manual_url, videosUrl: r.videos_url, buyUrl: r.buy_url, serviceEnabled: r.service_enabled, batches: r.batches, codes: r.codes });
const PRODUCT_SELECT = `
  select p.id, p.name, p.model, p.made_in, p.warranty_months, p.manual_url, p.videos_url, p.buy_url, p.service_enabled,
         (select count(*)::int from product_batches b where b.product_id = p.id) as batches,
         coalesce((select sum(b.qty)::int from product_batches b where b.product_id = p.id), 0) as codes
    from products p`;

export async function listProducts(workspaceId: string): Promise<ProductRecord[]> {
  return (await query<ProductRow>(`${PRODUCT_SELECT} where p.workspace_id = $1 and p.active order by p.created_at`, [workspaceId])).map(toProduct);
}
export async function getProduct(workspaceId: string, id: string): Promise<ProductRecord | null> {
  if (!isUuid(id)) return null;
  const [r] = await query<ProductRow>(`${PRODUCT_SELECT} where p.id = $1 and p.workspace_id = $2 and p.active`, [id, workspaceId]);
  return r ? toProduct(r) : null;
}
export async function createProduct(workspaceId: string, p: ProductInput): Promise<string> {
  const [r] = await query<{ id: string }>(
    "insert into products (workspace_id, name, model, made_in, warranty_months, manual_url, videos_url, buy_url, service_enabled) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id",
    [workspaceId, p.name, p.model, p.madeIn, p.warrantyMonths, p.manualUrl, p.videosUrl, p.buyUrl, p.serviceEnabled],
  );
  return r.id;
}
export async function updateProduct(workspaceId: string, id: string, p: ProductInput): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = await query("update products set name=$3, model=$4, made_in=$5, warranty_months=$6, manual_url=$7, videos_url=$8, buy_url=$9, service_enabled=$10 where id=$1 and workspace_id=$2 and active returning id", [id, workspaceId, p.name, p.model, p.madeIn, p.warrantyMonths, p.manualUrl, p.videosUrl, p.buyUrl, p.serviceEnabled]);
  return rows.length > 0;
}
/** A product that has had codes printed can't be deleted (the codes are out in the world); it is hidden instead. */
export async function retireProduct(workspaceId: string, id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  return (await query("update products set active = false where id = $1 and workspace_id = $2 and active returning id", [id, workspaceId])).length > 0;
}

/* =====================================================================
 * Batches and serial codes
 * ===================================================================== */

export type BatchRecord = { id: string; seq: number; label: string; productId: string; product: string; firstSerial: string; lastSerial: string; qty: number; activated: number; status: "printing" | "in_market"; format: BatchFormat; warrantyMonths: number; createdAt: string };
export const batchLabel = (seq: number) => `B-${String(seq).padStart(2, "0")}`;

export async function createBatch(workspaceId: string, b: BatchInput): Promise<{ ok: true; batch: BatchRecord } | { ok: false; error: "not_found" }> {
  const id = await tx(async (q) => {
    const [p] = await q.query<{ warranty_months: number }>("select warranty_months from products where id = $1 and workspace_id = $2 and active for update", [b.productId, workspaceId]);
    if (!p) return null;
    const [w] = await q.query<{ batch_seq: number }>("update workspaces set batch_seq = batch_seq + 1 where id = $1 returning batch_seq", [workspaceId]);
    // numbering continues after the highest number already used with this prefix, so serials never repeat
    const [m] = await q.query<{ last: number }>("select coalesce(max(last_no), 0)::int as last from product_batches where workspace_id = $1 and prefix = $2", [workspaceId, b.prefix]);
    const first = m.last + 1;
    const last = m.last + b.quantity;
    const months = b.warrantyMonths ?? p.warranty_months;
    const [row] = await q.query<{ id: string }>(
      "insert into product_batches (workspace_id, product_id, seq, prefix, first_no, last_no, qty, warranty_months, format) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id",
      [workspaceId, b.productId, w.batch_seq, b.prefix, first, last, b.quantity, months, b.format],
    );
    // each code carries its own random secret (64 bits), so a serial can't be guessed from its neighbours
    await q.query(
      `insert into product_codes (workspace_id, product_id, batch_id, serial, token)
       select $1, $2, $3, $4 || lpad(n::text, 6, '0'), substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)
         from generate_series($5::int, $6::int) n`,
      [workspaceId, b.productId, row.id, b.prefix, first, last],
    );
    return row.id;
  });
  if (!id) return { ok: false, error: "not_found" };
  return { ok: true, batch: (await getBatch(workspaceId, id))! };
}

type BatchRow = { id: string; seq: number; product_id: string; product: string; prefix: string; first_no: number; last_no: number; qty: number; activated: number; status: "printing" | "in_market"; format: BatchFormat; warranty_months: number; created_at: Date };
const BATCH_SELECT = `
  select b.id, b.seq, b.product_id, p.name as product, b.prefix, b.first_no, b.last_no, b.qty, b.status, b.format, b.warranty_months, b.created_at,
         (select count(*)::int from product_codes c where c.batch_id = b.id and c.scan_count > 0) as activated
    from product_batches b join products p on p.id = b.product_id`;
const toBatch = (r: BatchRow): BatchRecord => ({
  id: r.id, seq: r.seq, label: batchLabel(r.seq), productId: r.product_id, product: r.product, firstSerial: serialOf(r.prefix, r.first_no), lastSerial: serialOf(r.prefix, r.last_no),
  qty: r.qty, activated: r.activated, status: r.status, format: r.format, warrantyMonths: r.warranty_months, createdAt: r.created_at.toISOString(),
});

export async function listBatches(workspaceId: string, limit = 100): Promise<BatchRecord[]> {
  return (await query<BatchRow>(`${BATCH_SELECT} where b.workspace_id = $1 order by b.created_at desc, b.seq desc limit $2`, [workspaceId, limit])).map(toBatch);
}
export async function getBatch(workspaceId: string, id: string): Promise<BatchRecord | null> {
  if (!isUuid(id)) return null;
  const [r] = await query<BatchRow>(`${BATCH_SELECT} where b.id = $1 and b.workspace_id = $2`, [id, workspaceId]);
  return r ? toBatch(r) : null;
}
export async function markInMarket(workspaceId: string, id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  return (await query("update product_batches set status = 'in_market' where id = $1 and workspace_id = $2 returning id", [id, workspaceId])).length > 0;
}

/** Serial + secret token for a batch, in serial order. `offset`/`limit` page through it for the print sheet. */
export async function batchCodes(workspaceId: string, batchId: string, offset = 0, limit = MAX_EXPORT): Promise<{ serial: string; token: string }[]> {
  if (!isUuid(batchId)) return [];
  return query<{ serial: string; token: string }>("select serial, token from product_codes where batch_id = $1 and workspace_id = $2 order by serial offset $3 limit $4", [batchId, workspaceId, offset, limit]);
}
export const MAX_EXPORT = 20_000;

/* =====================================================================
 * The buyer's page: scan, warranty, report, service
 * ===================================================================== */

export type PublicProduct = {
  codeId: string;
  workspaceId: string;
  serial: string;
  business: string;
  logoId: string | null;
  suspended: boolean;
  product: { name: string; model: string; madeIn: string; manualUrl: string; videosUrl: string; buyUrl: string; serviceEnabled: boolean; warrantyMonths: number };
  madeOn: string;
  /** deliberately without the buyer's name: anyone holding the code can open this page */
  warranty: { validUntil: string; status: "verified" | "review" | "rejected" } | null;
};

export async function getPublicProduct(token: string): Promise<PublicProduct | null> {
  if (!/^[0-9a-f]{16}$/.test(token)) return null;
  const [r] = await query<{
    id: string; workspace_id: string; serial: string; business: string; logo: string | null; suspended: boolean; name: string; model: string; made_in: string; manual_url: string; videos_url: string; buy_url: string;
    service_enabled: boolean; warranty_months: number; made_on: Date; w_until: string | null; w_status: "verified" | "review" | "rejected" | null;
  }>(
    `select c.id, c.workspace_id, c.serial, w.name as business, w.logo_file_id as logo, w.suspended, p.name, p.model, p.made_in, p.manual_url, p.videos_url, p.buy_url, p.service_enabled, b.warranty_months,
            b.created_at as made_on, r.valid_until::text as w_until, r.status as w_status
       from product_codes c
       join workspaces w on w.id = c.workspace_id
       join products p on p.id = c.product_id
       join product_batches b on b.id = c.batch_id
       left join warranty_regs r on r.code_id = c.id
      where c.token = $1`,
    [token],
  );
  if (!r) return null;
  return {
    codeId: r.id, workspaceId: r.workspace_id, serial: r.serial, business: r.business, logoId: r.logo, suspended: r.suspended,
    product: { name: r.name, model: r.model, madeIn: r.made_in, manualUrl: r.manual_url, videosUrl: r.videos_url, buyUrl: r.buy_url, serviceEnabled: r.service_enabled, warrantyMonths: r.warranty_months },
    madeOn: r.made_on.toISOString(),
    warranty: r.w_until && r.w_status ? { validUntil: r.w_until, status: r.w_status } : null,
  };
}

export type Verdict = "first" | "again" | "scanned_before";
export type ScanResult = { verdict: Verdict; scanCount: number; firstScanAt: string | null; firstCity: string; thisCity: string };

/** Alerts raise once per code and kind. Returns the reason text when a new alert was created. */
async function raise(q: { query: <T>(sql: string, p?: unknown[]) => Promise<T[]> }, w: string, codeId: string, kind: "many_devices" | "two_cities" | "double_registration", reason: string): Promise<boolean> {
  const rows = await q.query("insert into counterfeit_alerts (workspace_id, code_id, kind, reason) values ($1,$2,$3,$4) on conflict (code_id, kind) where kind <> 'report' do nothing returning id", [w, codeId, kind, reason]);
  if (rows.length) await q.query("update product_codes set flagged = true where id = $1", [codeId]);
  return rows.length > 0;
}

const SAME_VISITOR_QUIET_MIN = 10;
export const MANY_DEVICES = 3;

/** Logs a scan of a serialized code and says what the buyer should be told. The same device re-opening the page within 10 minutes isn't counted again. */
export async function recordScan(pp: PublicProduct, visitor: string, city: string): Promise<ScanResult> {
  const raised: string[] = [];
  const result = await tx(async (q) => {
    const [c] = await q.query<{ scan_count: number; first_scan_at: Date | null; first_city: string | null }>("select scan_count, first_scan_at, first_city from product_codes where id = $1 for update", [pp.codeId]);
    const [prev] = await q.query<{ total: number; others: number; recent: number }>(
      `select count(*)::int as total, count(*) filter (where visitor <> $2)::int as others,
              count(*) filter (where visitor = $2 and at > now() - ($3 || ' minutes')::interval)::int as recent
         from product_scans where code_id = $1`,
      [pp.codeId, visitor, String(SAME_VISITOR_QUIET_MIN)],
    );
    const verdict: Verdict = prev.total === 0 ? "first" : prev.others === 0 ? "again" : "scanned_before";
    let count = c.scan_count;
    if (prev.recent === 0) {
      await q.query("insert into product_scans (code_id, workspace_id, visitor, city) values ($1,$2,$3,$4)", [pp.codeId, pp.workspaceId, visitor, city || null]);
      count += 1;
      await q.query("update product_codes set scan_count = scan_count + 1, first_scan_at = coalesce(first_scan_at, now()), first_city = coalesce(first_city, $2) where id = $1", [pp.codeId, city || null]);
      const [d] = await q.query<{ n: number }>("select count(distinct visitor)::int as n from product_scans where code_id = $1", [pp.codeId]);
      if (d.n >= MANY_DEVICES && (await raise(q, pp.workspaceId, pp.codeId, "many_devices", `Scanned from ${d.n} different devices.`))) raised.push("many_devices");
      const first = c.first_scan_at;
      if (city && c.first_city && first && c.first_city.toLowerCase() !== city.toLowerCase() && Date.now() - first.getTime() < 24 * 3_600_000) {
        const hrs = Math.max(1, Math.round((Date.now() - first.getTime()) / 3_600_000));
        if (await raise(q, pp.workspaceId, pp.codeId, "two_cities", `Scanned in ${c.first_city} and ${city} within ${hrs} hour${hrs === 1 ? "" : "s"}.`)) raised.push("two_cities");
      }
    }
    return { verdict, scanCount: count, firstScanAt: c.first_scan_at?.toISOString() ?? null, firstCity: c.first_city ?? "", thisCity: city };
  });
  for (const kind of raised) await emitEvent(pp.workspaceId, "counterfeit.flagged", { serial: pp.serial, kind });
  return result;
}

export type RegisterResult =
  | { ok: true; created: boolean; validUntil: string; status: "verified" | "review" }
  | { ok: false; error: "already_registered" };

/** One warranty per code. The same phone asking again gets its registration back; a different phone is refused and the code is flagged. */
export async function registerWarranty(pp: PublicProduct, i: WarrantyInput): Promise<RegisterResult> {
  let flagged = false;
  const res = await tx(async (q) => {
    const [c] = await q.query<{ flagged: boolean }>("select flagged from product_codes where id = $1 for update", [pp.codeId]);
    const [existing] = await q.query<{ phone: string; valid_until: string; status: "verified" | "review" | "rejected" }>("select phone, valid_until::text as valid_until, status from warranty_regs where code_id = $1", [pp.codeId]);
    if (existing) {
      if (existing.phone === i.phone) return { ok: true as const, created: false, validUntil: existing.valid_until, status: existing.status === "rejected" ? ("review" as const) : existing.status };
      flagged = await raise(q, pp.workspaceId, pp.codeId, "double_registration", "Someone tried to register this code with a different phone number.");
      return { ok: false as const, error: "already_registered" as const };
    }
    const [b] = await q.query<{ created: string }>("select to_char(b.created_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as created from product_codes c join product_batches b on b.id = c.batch_id where c.id = $1", [pp.codeId]);
    const early = i.purchasedOn < b.created; // bought before the code was even made
    const status = c.flagged || early ? ("review" as const) : ("verified" as const);
    const note = c.flagged ? "This code has been flagged for unusual scans." : early ? "Purchase date is before this batch was created." : "";
    const [r] = await q.query<{ valid_until: string }>(
      `insert into warranty_regs (workspace_id, code_id, name, phone, bought_from, invoice_no, purchased_on, valid_until, status, note)
       values ($1,$2,$3,$4,$5,$6,$7::date, ($7::date + ($8 || ' months')::interval)::date, $9, $10) returning valid_until::text as valid_until`,
      [pp.workspaceId, pp.codeId, i.name, i.phone, i.boughtFrom, i.invoiceNo, i.purchasedOn, String(pp.product.warrantyMonths), status, note],
    );
    await upsertContact(q, pp.workspaceId, { name: i.name, phone: i.phone, source: "Warranty" });
    return { ok: true as const, created: true, validUntil: r.valid_until, status };
  });
  if (!res.ok && flagged) await emitEvent(pp.workspaceId, "counterfeit.flagged", { serial: pp.serial, kind: "double_registration" });
  if (res.ok && res.created) await emitEvent(pp.workspaceId, "warranty.registered", { serial: pp.serial, product: pp.product.name, valid_until: res.validUntil, status: res.status });
  return res;
}

/** The buyer reports where they bought it. Becomes an alert for the brand. */
export async function reportSeller(pp: PublicProduct, note: string): Promise<void> {
  await query("insert into counterfeit_alerts (workspace_id, code_id, kind, reason) values ($1,$2,'report',$3)", [pp.workspaceId, pp.codeId, `Buyer report: ${note}`.slice(0, 450)]);
  await query("update product_codes set flagged = true where id = $1", [pp.codeId]);
  await emitEvent(pp.workspaceId, "counterfeit.flagged", { serial: pp.serial, kind: "report" });
}

/** "Book service" on the product page raises an ordinary ticket in Tickets & assets. */
export async function requestService(pp: PublicProduct, i: ServiceRequestInput, visitor: string): Promise<{ seq: number; token: string }> {
  const t = await createTicket(pp.workspaceId, {
    title: `Service: ${pp.product.name} · ${pp.serial}`,
    category: "Other",
    priority: "normal",
    place: pp.serial,
    details: i.problem,
    customerName: i.name,
    customerPhone: i.phone,
    assignee: "",
    source: "product_qr",
    visitor,
  });
  return { seq: t.seq, token: t.token };
}

/* =====================================================================
 * The owner's screen
 * ===================================================================== */

export type WarrantyRecord = { id: string; customer: string; phone: string; product: string; serial: string; boughtFrom: string; invoiceNo: string; purchasedOn: string; validUntil: string; status: "verified" | "review" | "rejected"; note: string; createdAt: string };
export async function listWarranty(workspaceId: string, opts: { status?: string; limit?: number } = {}): Promise<WarrantyRecord[]> {
  const rows = await query<{ id: string; name: string; phone: string; product: string; serial: string; bought_from: string; invoice_no: string; purchased_on: string; valid_until: string; status: "verified" | "review" | "rejected"; note: string; created_at: Date }>(
    `select r.id, r.name, r.phone, p.name as product, c.serial, r.bought_from, r.invoice_no, r.purchased_on::text as purchased_on, r.valid_until::text as valid_until, r.status, r.note, r.created_at
       from warranty_regs r join product_codes c on c.id = r.code_id join products p on p.id = c.product_id
      where r.workspace_id = $1 ${opts.status ? "and r.status = $3" : ""} order by (r.status = 'review') desc, r.created_at desc limit $2`,
    opts.status ? [workspaceId, opts.limit ?? 100, opts.status] : [workspaceId, opts.limit ?? 100],
  );
  return rows.map((r) => ({ id: r.id, customer: r.name, phone: r.phone, product: r.product, serial: r.serial, boughtFrom: r.bought_from, invoiceNo: r.invoice_no, purchasedOn: r.purchased_on, validUntil: r.valid_until, status: r.status, note: r.note, createdAt: r.created_at.toISOString() }));
}
export async function setWarrantyStatus(workspaceId: string, id: string, status: "verified" | "rejected"): Promise<boolean> {
  if (!isUuid(id)) return false;
  return (await query("update warranty_regs set status = $3 where id = $1 and workspace_id = $2 returning id", [id, workspaceId, status])).length > 0;
}

export type AlertStatus = "new" | "investigating" | "dismissed" | "confirmed";
export type AlertRecord = { id: string; serial: string; product: string; kind: string; reason: string; status: AlertStatus; scans: number; createdAt: string };
export async function listAlerts(workspaceId: string, opts: { limit?: number; open?: boolean } = {}): Promise<AlertRecord[]> {
  const rows = await query<{ id: string; serial: string; product: string; kind: string; reason: string; status: AlertStatus; scan_count: number; created_at: Date }>(
    `select a.id, c.serial, p.name as product, a.kind, a.reason, a.status, c.scan_count, a.created_at
       from counterfeit_alerts a join product_codes c on c.id = a.code_id join products p on p.id = c.product_id
      where a.workspace_id = $1 ${opts.open ? "and a.status in ('new','investigating')" : ""} order by (a.status = 'new') desc, a.created_at desc limit $2`,
    [workspaceId, opts.limit ?? 100],
  );
  return rows.map((r) => ({ id: r.id, serial: r.serial, product: r.product, kind: r.kind, reason: r.reason, status: r.status, scans: r.scan_count, createdAt: r.created_at.toISOString() }));
}
export async function setAlertStatus(workspaceId: string, id: string, status: AlertStatus): Promise<boolean> {
  if (!isUuid(id)) return false;
  return (await query("update counterfeit_alerts set status = $3 where id = $1 and workspace_id = $2 returning id", [id, workspaceId, status])).length > 0;
}

export type ProductStats = { issued: number; batches: number; activated: number; activatedPct: number; registrations: number; registrationsThisMonth: number; reviewing: number; openServices: number; suspected: number; newAlerts: number };
export async function productStats(workspaceId: string): Promise<ProductStats> {
  const monthStart = `${istDay().slice(0, 7)}-01`;
  const [r] = await query<{ issued: number; batches: number; activated: number; regs: number; regs_month: number; reviewing: number; services: number; suspected: number; new_alerts: number }>(
    `select coalesce((select sum(qty)::int from product_batches where workspace_id = $1), 0) as issued,
            (select count(*)::int from product_batches where workspace_id = $1) as batches,
            (select count(*)::int from product_codes where workspace_id = $1 and scan_count > 0) as activated,
            (select count(*)::int from warranty_regs where workspace_id = $1) as regs,
            (select count(*)::int from warranty_regs where workspace_id = $1 and created_at >= $2::date) as regs_month,
            (select count(*)::int from warranty_regs where workspace_id = $1 and status = 'review') as reviewing,
            (select count(*)::int from tickets where workspace_id = $1 and source = 'product_qr' and status <> 'resolved') as services,
            (select count(*)::int from product_codes where workspace_id = $1 and flagged) as suspected,
            (select count(*)::int from counterfeit_alerts where workspace_id = $1 and status = 'new') as new_alerts`,
    [workspaceId, monthStart],
  );
  return { issued: r.issued, batches: r.batches, activated: r.activated, activatedPct: r.issued ? Math.round((r.activated / r.issued) * 1000) / 10 : 0, registrations: r.regs, registrationsThisMonth: r.regs_month, reviewing: r.reviewing, openServices: r.services, suspected: r.suspected, newAlerts: r.new_alerts };
}
export const newAlertCount = async (workspaceId: string) => (await productStats(workspaceId)).newAlerts;

/** For the API: what is known about one serial. */
export async function lookupSerial(workspaceId: string, serial: string) {
  const [r] = await query<{ serial: string; product: string; batch_seq: number; scan_count: number; first_scan_at: Date | null; flagged: boolean; w_status: string | null; w_until: string | null }>(
    `select c.serial, p.name as product, b.seq as batch_seq, c.scan_count, c.first_scan_at, c.flagged, r.status as w_status, r.valid_until::text as w_until
       from product_codes c join products p on p.id = c.product_id join product_batches b on b.id = c.batch_id left join warranty_regs r on r.code_id = c.id
      where c.workspace_id = $1 and c.serial = $2`,
    [workspaceId, serial.toUpperCase()],
  );
  return r
    ? { serial: r.serial, product: r.product, batch: batchLabel(r.batch_seq), scan_count: r.scan_count, activated: r.scan_count > 0, first_scan_at: r.first_scan_at?.toISOString() ?? null, flagged: r.flagged, warranty: r.w_status ? { status: r.w_status, valid_until: r.w_until } : null }
    : null;
}
