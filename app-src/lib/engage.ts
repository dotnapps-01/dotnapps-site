import "server-only";
import { hmacHex, safeEqual } from "@/lib/auth/crypto";
import { query, tx } from "@/lib/db";
import { STAGES, type Stage } from "@/lib/engage-input";
import type { CouponInput, ImportRow, LeadFormInput, LoyaltyInput, Submission } from "@/lib/engage-input";
import { emitEvent } from "@/lib/webhooks";
import { emptyContent, type PageContent, type PageKind } from "@/lib/pages";

const uuidRe = /^[0-9a-f-]{36}$/i;
const isUuid = (v: string) => uuidRe.test(v);

/* =====================================================================
 * Pages
 * ===================================================================== */

export type PageRecord = {
  id: string;
  kind: PageKind;
  title: string;
  status: "draft" | "published";
  content: PageContent;
  updatedAt: string;
  scans30: number;
  inUse: number;
};

type PageRow = { id: string; kind: PageKind; title: string; status: "draft" | "published"; content: PageContent; updated_at: Date; scans30: number; in_use: number };

const PAGE_SELECT = `
  select p.id, p.kind, p.title, p.status, p.content, p.updated_at,
         (select count(*)::int from scans s join qr_codes q on q.id = s.qr_id
           where q.workspace_id = p.workspace_id and q.config->>'pageId' = p.id::text and s.scanned_at > now() - interval '30 days') as scans30,
         (select count(*)::int from qr_codes q where q.workspace_id = p.workspace_id and q.status <> 'archived' and q.config->>'pageId' = p.id::text) as in_use
    from pages p`;

const toPage = (r: PageRow): PageRecord => ({ id: r.id, kind: r.kind, title: r.title, status: r.status, content: r.content, updatedAt: r.updated_at.toISOString(), scans30: r.scans30, inUse: r.in_use });

export async function listPages(workspaceId: string): Promise<PageRecord[]> {
  const rows = await query<PageRow>(`${PAGE_SELECT} where p.workspace_id = $1 order by p.kind, lower(p.title)`, [workspaceId]);
  return rows.map(toPage);
}

export async function getPage(workspaceId: string, id: string): Promise<PageRecord | null> {
  if (!isUuid(id)) return null;
  const [r] = await query<PageRow>(`${PAGE_SELECT} where p.workspace_id = $1 and p.id = $2`, [workspaceId, id]);
  return r ? toPage(r) : null;
}

export async function createPage(workspaceId: string, kind: PageKind, title: string, content?: PageContent): Promise<string> {
  const [r] = await query<{ id: string }>("insert into pages (workspace_id, kind, title, content) values ($1,$2,$3,$4) returning id", [
    workspaceId,
    kind,
    title,
    JSON.stringify(content ?? emptyContent(kind)),
  ]);
  return r.id;
}

export async function updatePage(workspaceId: string, id: string, patch: { title: string; content: PageContent; status: "draft" | "published" }): Promise<boolean> {
  if (!isUuid(id)) return false;
  const r = await query(
    "update pages set title = $3, content = $4, status = $5, updated_at = now() where id = $1 and workspace_id = $2 returning id",
    [id, workspaceId, patch.title, JSON.stringify(patch.content), patch.status],
  );
  return r.length > 0;
}

export async function deletePage(workspaceId: string, id: string): Promise<"ok" | "in_use" | "not_found"> {
  const page = await getPage(workspaceId, id);
  if (!page) return "not_found";
  if (page.inUse > 0) return "in_use";
  await query("delete from pages where id = $1 and workspace_id = $2", [id, workspaceId]);
  return "ok";
}

/** Published pages only, for the public renderer. */
export async function getPublishedPage(workspaceId: string, id: string) {
  if (!isUuid(id)) return null;
  const [r] = await query<{ id: string; kind: PageKind; title: string; content: PageContent }>(
    "select id, kind, title, content from pages where id = $1 and workspace_id = $2 and status = 'published'",
    [id, workspaceId],
  );
  return r ?? null;
}

/* =====================================================================
 * Contacts
 * ===================================================================== */

export async function upsertContact(
  q: { query: <T>(sql: string, p?: unknown[]) => Promise<T[]> },
  workspaceId: string,
  c: { name?: string; phone: string; email?: string; source: string; optIn?: boolean },
): Promise<string> {
  const [r] = await q.query<{ id: string }>(
    `insert into contacts (workspace_id, name, phone, email, source, opt_in) values ($1,$2,$3,$4,$5,$6)
     on conflict (workspace_id, phone) where phone <> '' do update set
       visits = contacts.visits + 1,
       last_seen = now(),
       name = case when contacts.name = '' then excluded.name else contacts.name end,
       email = case when contacts.email = '' then excluded.email else contacts.email end,
       opt_in = contacts.opt_in or excluded.opt_in
     returning id`,
    [workspaceId, c.name ?? "", c.phone, c.email ?? "", c.source, c.optIn === true],
  );
  return r.id;
}

export type ContactRecord = { id: string; name: string; phone: string; email: string; source: string; tags: string[]; optIn: boolean; visits: number; lastSeen: string; createdAt: string };
export type Segment = "all" | "opted_in" | "loyalty" | "inactive";
export const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "all", label: "All contacts" },
  { key: "opted_in", label: "Opted in to offers" },
  { key: "loyalty", label: "Loyalty members" },
  { key: "inactive", label: "Inactive 60+ days" },
];

const SEGMENT_SQL: Record<Segment, string> = {
  all: "true",
  opted_in: "c.opt_in",
  loyalty: "exists (select 1 from loyalty_cards l where l.workspace_id = c.workspace_id and l.phone = c.phone)",
  inactive: "c.last_seen < now() - interval '60 days'",
};

export async function listContacts(workspaceId: string, opts: { segment?: Segment; q?: string; limit?: number } = {}): Promise<ContactRecord[]> {
  const params: unknown[] = [workspaceId];
  let where = `c.workspace_id = $1 and ${SEGMENT_SQL[opts.segment ?? "all"] ?? "true"}`;
  if (opts.q?.trim()) {
    params.push(`%${opts.q.trim().toLowerCase().replace(/[%_]/g, "")}%`);
    where += ` and (lower(c.name) like $${params.length} or c.phone like $${params.length})`;
  }
  const rows = await query<{ id: string; name: string; phone: string; email: string; source: string; tags: string[]; opt_in: boolean; visits: number; last_seen: Date; created_at: Date }>(
    `select c.id, c.name, c.phone, c.email, c.source, c.tags, c.opt_in, c.visits, c.last_seen, c.created_at from contacts c
      where ${where} order by c.last_seen desc limit ${Math.min(opts.limit ?? 200, 500)}`,
    params,
  );
  return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, email: r.email, source: r.source, tags: r.tags, optIn: r.opt_in, visits: r.visits, lastSeen: r.last_seen.toISOString(), createdAt: r.created_at.toISOString() }));
}

export async function segmentCounts(workspaceId: string): Promise<Record<Segment, number>> {
  const out = {} as Record<Segment, number>;
  await Promise.all(
    SEGMENTS.map(async (s) => {
      const [r] = await query<{ n: number }>(`select count(*)::int as n from contacts c where c.workspace_id = $1 and ${SEGMENT_SQL[s.key]}`, [workspaceId]);
      out[s.key] = r.n;
    }),
  );
  return out;
}

export async function importContacts(workspaceId: string, rows: ImportRow[]): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;
  await tx(async (q) => {
    for (const r of rows) {
      const [x] = await q.query<{ inserted: boolean }>(
        `insert into contacts (workspace_id, name, phone, email, source, tags, visits) values ($1,$2,$3,$4,'Import',$5,0)
         on conflict (workspace_id, phone) where phone <> '' do update set
           name = case when contacts.name = '' then excluded.name else contacts.name end,
           email = case when contacts.email = '' then excluded.email else contacts.email end,
           tags = (select array(select distinct unnest(contacts.tags || excluded.tags)))
         returning (xmax = 0) as inserted`,
        [workspaceId, r.name, r.phone, r.email, r.tags],
      );
      if (x.inserted) added++;
      else updated++;
    }
  });
  return { added, updated };
}

/* =====================================================================
 * Lead forms and leads
 * ===================================================================== */

export type FormRecord = LeadFormInput & { id: string; leads: number; inUse: number };
type FormRow = { id: string; title: string; intro: string; fields: string[]; interests: string[]; submit_label: string; notify_phone: string; leads: number; in_use: number };
const FORM_SELECT = `
  select f.id, f.title, f.intro, f.fields, f.interests, f.submit_label, f.notify_phone,
         (select count(*)::int from leads l where l.form_id = f.id) as leads,
         (select count(*)::int from qr_codes q where q.workspace_id = f.workspace_id and q.status <> 'archived' and q.config->>'formId' = f.id::text) as in_use
    from lead_forms f`;
const toForm = (r: FormRow): FormRecord => ({ id: r.id, title: r.title, intro: r.intro, fields: r.fields as FormRecord["fields"], interests: r.interests, submitLabel: r.submit_label, notifyPhone: r.notify_phone, leads: r.leads, inUse: r.in_use });

export async function listForms(workspaceId: string): Promise<FormRecord[]> {
  return (await query<FormRow>(`${FORM_SELECT} where f.workspace_id = $1 order by f.created_at desc`, [workspaceId])).map(toForm);
}
export async function getForm(workspaceId: string, id: string): Promise<FormRecord | null> {
  if (!isUuid(id)) return null;
  const [r] = await query<FormRow>(`${FORM_SELECT} where f.workspace_id = $1 and f.id = $2`, [workspaceId, id]);
  return r ? toForm(r) : null;
}
export async function createForm(workspaceId: string, f: LeadFormInput): Promise<string> {
  const [r] = await query<{ id: string }>(
    "insert into lead_forms (workspace_id, title, intro, fields, interests, submit_label, notify_phone) values ($1,$2,$3,$4,$5,$6,$7) returning id",
    [workspaceId, f.title, f.intro, f.fields, f.interests, f.submitLabel, f.notifyPhone],
  );
  return r.id;
}
export async function updateForm(workspaceId: string, id: string, f: LeadFormInput): Promise<boolean> {
  if (!isUuid(id)) return false;
  const r = await query(
    "update lead_forms set title=$3, intro=$4, fields=$5, interests=$6, submit_label=$7, notify_phone=$8, updated_at=now() where id=$1 and workspace_id=$2 returning id",
    [id, workspaceId, f.title, f.intro, f.fields, f.interests, f.submitLabel, f.notifyPhone],
  );
  return r.length > 0;
}
export async function deleteForm(workspaceId: string, id: string): Promise<"ok" | "in_use" | "not_found"> {
  const f = await getForm(workspaceId, id);
  if (!f) return "not_found";
  if (f.inUse > 0) return "in_use";
  await query("delete from lead_forms where id = $1 and workspace_id = $2", [id, workspaceId]);
  return "ok";
}

export { STAGES };
export type { Stage };

export type LeadRecord = {
  id: string;
  name: string;
  phone: string;
  email: string;
  interest: string;
  preferredTime: string;
  message: string;
  source: string;
  stage: Stage;
  owner: string;
  notes: string;
  createdAt: string;
};

export async function createLead(p: { workspaceId: string; formId: string; qrId: string; qrName: string; visitor: string; s: Submission }): Promise<string> {
  const id = await tx(async (q) => {
    const contactId = await upsertContact(q, p.workspaceId, { name: p.s.name, phone: p.s.phone, email: p.s.email, source: "Lead form", optIn: p.s.optIn });
    const [l] = await q.query<{ id: string }>(
      `insert into leads (workspace_id, form_id, qr_id, contact_id, name, phone, email, interest, preferred_time, message, source, visitor)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
      [p.workspaceId, p.formId, p.qrId, contactId, p.s.name, p.s.phone, p.s.email, p.s.interest, p.s.time, p.s.message, p.qrName, p.visitor],
    );
    return l.id;
  });
  await emitEvent(p.workspaceId, "lead.created", { lead_id: id, name: p.s.name, phone: p.s.phone, interest: p.s.interest, source: p.qrName });
  return id;
}

export async function listLeads(workspaceId: string, limit = 300): Promise<LeadRecord[]> {
  const rows = await query<{ id: string; name: string; phone: string; email: string; interest: string; preferred_time: string; message: string; source: string; stage: Stage; owner: string; notes: string; created_at: Date }>(
    `select id, name, phone, email, interest, preferred_time, message, source, stage, owner, notes, created_at
       from leads where workspace_id = $1 order by created_at desc limit $2`,
    [workspaceId, limit],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, email: r.email, interest: r.interest, preferredTime: r.preferred_time, message: r.message, source: r.source, stage: r.stage, owner: r.owner, notes: r.notes, createdAt: r.created_at.toISOString() }));
}

export async function updateLead(workspaceId: string, id: string, patch: { stage?: Stage; owner?: string; notes?: string }): Promise<boolean> {
  if (!isUuid(id)) return false;
  const r = await query(
    `update leads set stage = coalesce($3, stage), owner = coalesce($4, owner), notes = coalesce($5, notes), updated_at = now()
      where id = $1 and workspace_id = $2 returning id`,
    [id, workspaceId, patch.stage ?? null, patch.owner ?? null, patch.notes ?? null],
  );
  return r.length > 0;
}

export async function newLeadCount(workspaceId: string): Promise<number> {
  const [r] = await query<{ n: number }>("select count(*)::int as n from leads where workspace_id = $1 and stage = 'new'", [workspaceId]);
  return r.n;
}

/* =====================================================================
 * Coupons
 * ===================================================================== */

export type CouponRecord = CouponInput & { id: string; claimed: number; redeemed: number; inUse: number; state: "live" | "paused" | "scheduled" | "ended" };
type CouponRow = {
  id: string;
  title: string;
  headline: string;
  description: string;
  code_prefix: string;
  valid_days: number;
  starts_at: Date | null;
  ends_at: Date | null;
  total_limit: number | null;
  per_customer: number;
  status: "active" | "paused";
  claimed: number;
  redeemed: number;
  in_use: number;
};
const COUPON_SELECT = `
  select c.id, c.title, c.headline, c.description, c.code_prefix, c.valid_days, c.starts_at, c.ends_at, c.total_limit, c.per_customer, c.status,
         (select count(*)::int from coupon_claims k where k.coupon_id = c.id) as claimed,
         (select count(*)::int from coupon_claims k where k.coupon_id = c.id and k.redeemed_at is not null) as redeemed,
         (select count(*)::int from qr_codes q where q.workspace_id = c.workspace_id and q.status <> 'archived' and q.config->>'couponId' = c.id::text) as in_use
    from coupons c`;

export function couponState(c: { status: string; starts_at: Date | null; ends_at: Date | null; total_limit: number | null; claimed: number }, now = new Date()): CouponRecord["state"] {
  if (c.ends_at && c.ends_at <= now) return "ended";
  if (c.total_limit !== null && c.claimed >= c.total_limit) return "ended";
  if (c.status === "paused") return "paused";
  if (c.starts_at && c.starts_at > now) return "scheduled";
  return "live";
}
const toCoupon = (r: CouponRow): CouponRecord => ({
  id: r.id,
  title: r.title,
  headline: r.headline,
  description: r.description,
  codePrefix: r.code_prefix,
  validDays: r.valid_days,
  startsAt: r.starts_at?.toISOString() ?? null,
  endsAt: r.ends_at?.toISOString() ?? null,
  totalLimit: r.total_limit,
  perCustomer: r.per_customer,
  status: r.status,
  claimed: r.claimed,
  redeemed: r.redeemed,
  inUse: r.in_use,
  state: couponState(r),
});

export async function listCoupons(workspaceId: string): Promise<CouponRecord[]> {
  return (await query<CouponRow>(`${COUPON_SELECT} where c.workspace_id = $1 order by c.created_at desc`, [workspaceId])).map(toCoupon);
}
export async function getCoupon(workspaceId: string, id: string): Promise<CouponRecord | null> {
  if (!isUuid(id)) return null;
  const [r] = await query<CouponRow>(`${COUPON_SELECT} where c.workspace_id = $1 and c.id = $2`, [workspaceId, id]);
  return r ? toCoupon(r) : null;
}
export async function createCoupon(workspaceId: string, c: CouponInput): Promise<string> {
  const [r] = await query<{ id: string }>(
    `insert into coupons (workspace_id, title, headline, description, code_prefix, valid_days, starts_at, ends_at, total_limit, per_customer, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
    [workspaceId, c.title, c.headline, c.description, c.codePrefix, c.validDays, c.startsAt, c.endsAt, c.totalLimit, c.perCustomer, c.status],
  );
  return r.id;
}
export async function updateCoupon(workspaceId: string, id: string, c: CouponInput): Promise<boolean> {
  if (!isUuid(id)) return false;
  const r = await query(
    `update coupons set title=$3, headline=$4, description=$5, code_prefix=$6, valid_days=$7, starts_at=$8, ends_at=$9, total_limit=$10, per_customer=$11, status=$12
      where id=$1 and workspace_id=$2 returning id`,
    [id, workspaceId, c.title, c.headline, c.description, c.codePrefix, c.validDays, c.startsAt, c.endsAt, c.totalLimit, c.perCustomer, c.status],
  );
  return r.length > 0;
}
export async function deleteCoupon(workspaceId: string, id: string): Promise<"ok" | "in_use" | "not_found"> {
  const c = await getCoupon(workspaceId, id);
  if (!c) return "not_found";
  if (c.inUse > 0) return "in_use";
  await query("delete from coupons where id = $1 and workspace_id = $2", [id, workspaceId]);
  return "ok";
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const randomCodePart = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");

export type Claim = { code: string; expiresAt: string; redeemed: boolean; headline: string; title: string; description: string };
export type ClaimResult =
  | { ok: true; claim: Claim; existing: boolean }
  | { ok: false; reason: "paused" | "not_started" | "ended" | "sold_out" | "limit_reached"; claim?: Claim };

export async function claimCoupon(p: { workspaceId: string; couponId: string; qrId: string; phone: string; name: string; optIn: boolean; visitor: string }): Promise<ClaimResult> {
  return tx(async (q) => {
    const [c] = await q.query<CouponRow>(`${COUPON_SELECT} where c.workspace_id = $1 and c.id = $2`, [p.workspaceId, p.couponId]);
    if (!c) return { ok: false, reason: "ended" } as ClaimResult;
    const toClaim = (r: { code: string; expires_at: Date; redeemed_at: Date | null }): Claim => ({ code: r.code, expiresAt: r.expires_at.toISOString(), redeemed: r.redeemed_at !== null, headline: c.headline, title: c.title, description: c.description });

    const mine = await q.query<{ code: string; expires_at: Date; redeemed_at: Date | null }>(
      "select code, expires_at, redeemed_at from coupon_claims where coupon_id = $1 and phone = $2 order by claimed_at desc",
      [p.couponId, p.phone],
    );
    const now = new Date();
    if (mine.length >= c.per_customer) return { ok: false, reason: "limit_reached", claim: toClaim(mine[0]) };
    const state = couponState(c, now);
    if (state === "ended") return { ok: false, reason: c.total_limit !== null && c.claimed >= c.total_limit ? "sold_out" : "ended" };
    if (state === "paused") return { ok: false, reason: "paused" };
    if (state === "scheduled") return { ok: false, reason: "not_started" };

    const contactId = await upsertContact(q, p.workspaceId, { name: p.name, phone: p.phone, source: "Coupon", optIn: p.optIn });
    let expires = new Date(now.getTime() + c.valid_days * 86_400_000);
    if (c.ends_at && c.ends_at < expires) expires = c.ends_at;
    for (let i = 0; i < 6; i++) {
      const code = `${c.code_prefix}-${randomCodePart(4)}`;
      const ins = await q.query<{ code: string; expires_at: Date; redeemed_at: Date | null }>(
        `insert into coupon_claims (coupon_id, workspace_id, qr_id, contact_id, phone, code, expires_at, visitor)
         values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (code) do nothing returning code, expires_at, redeemed_at`,
        [p.couponId, p.workspaceId, p.qrId, contactId, p.phone, code, expires, p.visitor],
      );
      if (ins.length) return { ok: true, claim: toClaim(ins[0]), existing: false };
    }
    throw new Error("could not allocate a coupon code");
  });
}

/* ---------- redeeming (coupon claims and loyalty rewards) ---------- */

export type CodeLookup = { kind: "coupon" | "reward"; code: string; label: string; detail: string; phone: string; status: "valid" | "expired" | "redeemed"; expiresAt: string | null; redeemedAt: string | null };

export async function lookupCode(workspaceId: string, raw: string): Promise<CodeLookup | null> {
  const code = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9-]{4,20}$/.test(code)) return null;
  const [c] = await query<{ code: string; title: string; headline: string; phone: string; expires_at: Date; redeemed_at: Date | null }>(
    `select k.code, c.title, c.headline, k.phone, k.expires_at, k.redeemed_at
       from coupon_claims k join coupons c on c.id = k.coupon_id where k.workspace_id = $1 and k.code = $2`,
    [workspaceId, code],
  );
  if (c) {
    const status = c.redeemed_at ? "redeemed" : c.expires_at <= new Date() ? "expired" : "valid";
    return { kind: "coupon", code: c.code, label: `${c.headline} · ${c.title}`, detail: "Coupon", phone: c.phone, status, expiresAt: c.expires_at.toISOString(), redeemedAt: c.redeemed_at?.toISOString() ?? null };
  }
  const [r] = await query<{ code: string; reward: string; phone: string; redeemed_at: Date | null }>(
    `select w.code, p.reward, c.phone, w.redeemed_at from loyalty_rewards w
       join loyalty_cards c on c.id = w.card_id left join loyalty_programs p on p.workspace_id = w.workspace_id
      where w.workspace_id = $1 and w.code = $2`,
    [workspaceId, code],
  );
  if (r) return { kind: "reward", code: r.code, label: r.reward ?? "Loyalty reward", detail: "Loyalty reward", phone: r.phone, status: r.redeemed_at ? "redeemed" : "valid", expiresAt: null, redeemedAt: r.redeemed_at?.toISOString() ?? null };
  return null;
}

export async function redeemCode(workspaceId: string, raw: string, by: string): Promise<{ ok: true; lookup: CodeLookup } | { ok: false; reason: "not_found" | "expired" | "redeemed" }> {
  const found = await lookupCode(workspaceId, raw);
  if (!found) return { ok: false, reason: "not_found" };
  if (found.status === "expired") return { ok: false, reason: "expired" };
  if (found.status === "redeemed") return { ok: false, reason: "redeemed" };
  const table = found.kind === "coupon" ? "coupon_claims" : "loyalty_rewards";
  // the WHERE makes this atomic: two staff scanning the same code can't both succeed
  const done = await query(
    `update ${table} set redeemed_at = now(), redeemed_by = $3 where workspace_id = $1 and code = $2 and redeemed_at is null ${found.kind === "coupon" ? "and expires_at > now()" : ""} returning code`,
    [workspaceId, found.code, by.slice(0, 40)],
  );
  if (!done.length) return { ok: false, reason: "redeemed" };
  return { ok: true, lookup: { ...found, status: "redeemed", redeemedAt: new Date().toISOString() } };
}

export type RedemptionItem = { who: string; what: string; at: string; kind: "coupon" | "reward" };
export async function recentRedemptions(workspaceId: string, limit = 8): Promise<RedemptionItem[]> {
  const rows = await query<{ who: string; what: string; at: Date; kind: "coupon" | "reward" }>(
    `select * from (
       select coalesce(nullif(ct.name, ''), k.phone) as who, c.title as what, k.redeemed_at as at, 'coupon'::text as kind
         from coupon_claims k join coupons c on c.id = k.coupon_id left join contacts ct on ct.id = k.contact_id
        where k.workspace_id = $1 and k.redeemed_at is not null
       union all
       select coalesce(nullif(l.name, ''), l.phone), 'Loyalty reward', w.redeemed_at, 'reward'
         from loyalty_rewards w join loyalty_cards l on l.id = w.card_id
        where w.workspace_id = $1 and w.redeemed_at is not null
     ) x order by at desc limit $2`,
    [workspaceId, limit],
  );
  return rows.map((r) => ({ who: r.who, what: r.what, at: r.at.toISOString(), kind: r.kind }));
}

/* =====================================================================
 * Loyalty
 * ===================================================================== */

export type ProgramRecord = { name: string; stampsNeeded: number; reward: string; expiresMonths: number | null; active: boolean; hasPin: boolean };

export async function getProgram(workspaceId: string): Promise<ProgramRecord | null> {
  const [r] = await query<{ name: string; stamps_needed: number; reward: string; expires_months: number | null; active: boolean; pin_hash: string }>(
    "select name, stamps_needed, reward, expires_months, active, pin_hash from loyalty_programs where workspace_id = $1",
    [workspaceId],
  );
  return r ? { name: r.name, stampsNeeded: r.stamps_needed, reward: r.reward, expiresMonths: r.expires_months, active: r.active, hasPin: r.pin_hash !== "" } : null;
}

const pinHash = (workspaceId: string, pin: string) => hmacHex(`pin:${workspaceId}:${pin}`);

export async function saveProgram(workspaceId: string, p: LoyaltyInput): Promise<void> {
  const hash = p.pin ? await pinHash(workspaceId, p.pin) : null;
  await query(
    `insert into loyalty_programs (workspace_id, name, stamps_needed, reward, pin_hash, expires_months, active, updated_at)
     values ($1,$2,$3,$4,coalesce($5,''),$6,$7,now())
     on conflict (workspace_id) do update set name=$2, stamps_needed=$3, reward=$4, pin_hash=coalesce($5, loyalty_programs.pin_hash), expires_months=$6, active=$7, updated_at=now()`,
    [workspaceId, p.name, p.stampsNeeded, p.reward, hash, p.expiresMonths, p.active],
  );
}

export type CardState = { phone: string; name: string; stamps: number; needed: number; rewards: { code: string }[]; earned: number; reward: string; programName: string; stampedToday: boolean };

const istDay = (d: Date) => new Date(d.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);

async function cardState(q: { query: <T>(sql: string, p?: unknown[]) => Promise<T[]> }, workspaceId: string, cardId: string): Promise<CardState> {
  const [c] = await q.query<{ phone: string; name: string; stamps: number; rewards_earned: number; last_stamp_at: Date | null }>("select phone, name, stamps, rewards_earned, last_stamp_at from loyalty_cards where id = $1", [cardId]);
  const [p] = await q.query<{ name: string; stamps_needed: number; reward: string }>("select name, stamps_needed, reward from loyalty_programs where workspace_id = $1", [workspaceId]);
  const rewards = await q.query<{ code: string }>("select code from loyalty_rewards where card_id = $1 and redeemed_at is null order by earned_at", [cardId]);
  // Anyone who knows a number can ask for its card, so the public view never includes the name or full number.
  return {
    phone: `${c.phone.slice(0, 3)}${"x".repeat(Math.max(0, c.phone.length - 6))}${c.phone.slice(-3)}`,
    name: "",
    stamps: c.stamps,
    needed: p.stamps_needed,
    rewards,
    earned: c.rewards_earned,
    reward: p.reward,
    programName: p.name,
    stampedToday: c.last_stamp_at ? istDay(c.last_stamp_at) === istDay(new Date()) : false,
  };
}

export async function joinCard(p: { workspaceId: string; qrId: string; phone: string; name: string; optIn: boolean }): Promise<CardState> {
  return tx(async (q) => {
    const contactId = await upsertContact(q, p.workspaceId, { name: p.name, phone: p.phone, source: "Loyalty card", optIn: p.optIn });
    const [c] = await q.query<{ id: string }>(
      `insert into loyalty_cards (workspace_id, contact_id, qr_id, phone, name) values ($1,$2,$3,$4,$5)
       on conflict (workspace_id, phone) do update set name = case when loyalty_cards.name = '' then excluded.name else loyalty_cards.name end
       returning id`,
      [p.workspaceId, contactId, p.qrId, p.phone, p.name],
    );
    return cardState(q, p.workspaceId, c.id);
  });
}

export async function viewCard(workspaceId: string, phone: string): Promise<CardState | null> {
  const [c] = await query<{ id: string }>("select id from loyalty_cards where workspace_id = $1 and phone = $2", [workspaceId, phone]);
  if (!c) return null;
  return cardState({ query }, workspaceId, c.id);
}

const MAX_PIN_FAILS = 5;
const LOCK_MINUTES = 15;

export type StampResult =
  | { ok: true; card: CardState; rewardEarned: boolean }
  | { ok: false; reason: "no_card" | "inactive" | "no_pin" | "locked" | "bad_pin" | "already_today"; attemptsLeft?: number; card?: CardState };

/** A staff member adds a stamp with the workspace's 4-digit PIN. Rate-limited per card; one stamp per day. */
export async function addStamp(p: { workspaceId: string; phone: string; pin: string; qrId: string | null }): Promise<StampResult> {
  return tx(async (q) => {
    const [card] = await q.query<{ id: string; stamps: number; last_stamp_at: Date | null; created_at: Date; pin_failures: number; pin_locked_until: Date | null }>(
      "select id, stamps, last_stamp_at, created_at, pin_failures, pin_locked_until from loyalty_cards where workspace_id = $1 and phone = $2 for update",
      [p.workspaceId, p.phone],
    );
    if (!card) return { ok: false, reason: "no_card" } as StampResult;
    const [prog] = await q.query<{ stamps_needed: number; pin_hash: string; active: boolean; expires_months: number | null }>(
      "select stamps_needed, pin_hash, active, expires_months from loyalty_programs where workspace_id = $1",
      [p.workspaceId],
    );
    if (!prog || !prog.active) return { ok: false, reason: "inactive" };
    if (!prog.pin_hash) return { ok: false, reason: "no_pin" };

    const now = new Date();
    if (card.pin_locked_until && card.pin_locked_until > now) return { ok: false, reason: "locked" };

    const given = await pinHash(p.workspaceId, p.pin);
    if (!/^\d{4}$/.test(p.pin) || !safeEqual(given, prog.pin_hash)) {
      const fails = card.pin_failures + 1;
      const lock = fails >= MAX_PIN_FAILS ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null;
      await q.query("update loyalty_cards set pin_failures = $2, pin_locked_until = $3 where id = $1", [card.id, lock ? 0 : fails, lock]);
      return lock ? { ok: false, reason: "locked" } : { ok: false, reason: "bad_pin", attemptsLeft: MAX_PIN_FAILS - fails };
    }

    // expired cards start over
    let stamps = card.stamps;
    if (prog.expires_months) {
      const since = card.last_stamp_at ?? card.created_at;
      const expiry = new Date(since);
      expiry.setMonth(expiry.getMonth() + prog.expires_months);
      if (expiry < now) stamps = 0;
    }
    if (card.last_stamp_at && istDay(card.last_stamp_at) === istDay(now)) {
      await q.query("update loyalty_cards set pin_failures = 0 where id = $1", [card.id]);
      return { ok: false, reason: "already_today", card: await cardState(q, p.workspaceId, card.id) };
    }

    stamps += 1;
    let earned = false;
    if (stamps >= prog.stamps_needed) {
      stamps -= prog.stamps_needed;
      earned = true;
      for (let i = 0; i < 6; i++) {
        const ins = await q.query("insert into loyalty_rewards (card_id, workspace_id, code) values ($1,$2,$3) on conflict (code) do nothing returning id", [card.id, p.workspaceId, `RWD-${randomCodePart(6)}`]);
        if (ins.length) break;
      }
    }
    await q.query("update loyalty_cards set stamps = $2, rewards_earned = rewards_earned + $3, last_stamp_at = now(), pin_failures = 0, pin_locked_until = null where id = $1", [card.id, stamps, earned ? 1 : 0]);
    await q.query("insert into loyalty_stamps (card_id, workspace_id, qr_id) values ($1,$2,$3)", [card.id, p.workspaceId, p.qrId]);
    return { ok: true, card: await cardState(q, p.workspaceId, card.id), rewardEarned: earned };
  });
}

export type OfferStats = { activeOffers: number; redemptions30: number; members: number; stamps30: number; rewardsEarned: number };
export async function getOfferStats(workspaceId: string): Promise<OfferStats> {
  const [a] = await query<{ n: number }>(
    "select count(*)::int as n from coupons where workspace_id = $1 and status = 'active' and (ends_at is null or ends_at > now()) and (starts_at is null or starts_at <= now())",
    [workspaceId],
  );
  const [r] = await query<{ n: number }>(
    `select ((select count(*) from coupon_claims where workspace_id = $1 and redeemed_at > now() - interval '30 days')
           + (select count(*) from loyalty_rewards where workspace_id = $1 and redeemed_at > now() - interval '30 days'))::int as n`,
    [workspaceId],
  );
  const [m] = await query<{ members: number; rewards: number }>("select count(*)::int as members, coalesce(sum(rewards_earned),0)::int as rewards from loyalty_cards where workspace_id = $1", [workspaceId]);
  const [s] = await query<{ n: number }>("select count(*)::int as n from loyalty_stamps where workspace_id = $1 and at > now() - interval '30 days'", [workspaceId]);
  return { activeOffers: a.n, redemptions30: r.n, members: m.members, stamps30: s.n, rewardsEarned: m.rewards };
}

/* =====================================================================
 * Analytics hook: what each QR code produced
 * ===================================================================== */

/** Actions per QR code for Engage types over a period: leads, coupon claims and loyalty joins/stamps. */
export async function engageActionsByQr(workspaceId: string, from: Date, to: Date): Promise<Map<string, { count: number; text: string }>> {
  const [leads, claims, joins, stamps] = await Promise.all([
    query<{ qr_id: string; n: number }>("select qr_id, count(*)::int as n from leads where workspace_id = $1 and created_at >= $2 and created_at < $3 and qr_id is not null group by 1", [workspaceId, from, to]),
    query<{ qr_id: string; n: number; red: number }>(
      "select qr_id, count(*)::int as n, count(*) filter (where redeemed_at is not null)::int as red from coupon_claims where workspace_id = $1 and claimed_at >= $2 and claimed_at < $3 and qr_id is not null group by 1",
      [workspaceId, from, to],
    ),
    query<{ qr_id: string; n: number }>("select qr_id, count(*)::int as n from loyalty_cards where workspace_id = $1 and created_at >= $2 and created_at < $3 and qr_id is not null group by 1", [workspaceId, from, to]),
    query<{ qr_id: string; n: number }>("select qr_id, count(*)::int as n from loyalty_stamps where workspace_id = $1 and at >= $2 and at < $3 and qr_id is not null group by 1", [workspaceId, from, to]),
  ]);
  const out = new Map<string, { count: number; text: string }>();
  for (const l of leads) out.set(l.qr_id, { count: l.n, text: `${l.n} ${l.n === 1 ? "lead" : "leads"}` });
  for (const c of claims) out.set(c.qr_id, { count: c.n, text: `${c.n} claimed · ${c.red} redeemed` });
  for (const j of joins) out.set(j.qr_id, { count: j.n, text: `${j.n} joined` });
  for (const s of stamps) {
    const prev = out.get(s.qr_id);
    out.set(s.qr_id, { count: (prev?.count ?? 0) + s.n, text: `${prev ? `${prev.text} · ` : ""}${s.n} stamps` });
  }
  return out;
}
