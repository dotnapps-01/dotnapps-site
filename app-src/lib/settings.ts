import "server-only";
import { query, tx } from "@/lib/db";
import { industryOptions } from "@/lib/content/onboarding";
import { toCsv } from "@/lib/csv";
import { EXPORTS, RETENTION, type ExportKey } from "@/lib/settings-input";
export { EXPORTS, RETENTION, type ExportKey };
import { dynamicLimit } from "@/lib/qr-types";
import { deleteWorkspaceFiles, quotaBytes, storageUsed } from "@/lib/files";
import type { Result } from "@/lib/engage-input";
import type { Workspace } from "@/lib/workspace";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const fail = <T,>(fields: Record<string, string>): Result<T> => ({ ok: false, fields });
const uuidRe = /^[0-9a-f-]{36}$/i;

/* ---------- business profile ---------- */

export type ProfileInput = { name: string; industry: string; gstin: string; defaultLang: "en" | "ta" | "hi" };
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function parseProfile(raw: unknown): Result<ProfileInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const name = str(r.name, 120);
  if (name.length < 2) f.name = "Enter your business name.";
  const industry = str(r.industry, 30);
  if (industry && !industryOptions.some((i) => i.key === industry)) f.industry = "Choose a category from the list.";
  const gstin = str(r.gstin, 15).toUpperCase();
  if (gstin && !GSTIN.test(gstin)) f.gstin = "A GSTIN has 15 characters, like 33ABCDE1234F1Z5. Leave it blank if you don't have one.";
  const defaultLang = str(r.defaultLang, 2) || "en";
  if (!["en", "ta", "hi"].includes(defaultLang)) f.defaultLang = "Choose English, Tamil or Hindi.";
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: { name, industry, gstin, defaultLang: defaultLang as ProfileInput["defaultLang"] } };
}

export async function saveProfile(workspaceId: string, p: ProfileInput): Promise<void> {
  await query("update workspaces set name = $2, industry = $3, gstin = $4, default_lang = $5 where id = $1", [workspaceId, p.name, p.industry, p.gstin, p.defaultLang]);
}

/* ---------- locations ---------- */

export type LocationRecord = { id: string; name: string; address: string; primary: boolean; qrCodes: number };
export async function listLocationsFull(workspaceId: string): Promise<LocationRecord[]> {
  const rows = await query<{ id: string; name: string; address: string; is_primary: boolean; qr: number }>(
    "select l.id, l.name, l.address, l.is_primary, (select count(*)::int from qr_codes q where q.location_id = l.id and q.status <> 'archived') as qr from locations l where l.workspace_id = $1 order by l.is_primary desc, l.created_at",
    [workspaceId],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, address: r.address, primary: r.is_primary, qrCodes: r.qr }));
}

export function parseLocation(raw: unknown): Result<{ name: string; address: string }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = str(r.name, 120);
  return name.length < 2 ? fail({ name: "Give the location a name (2+ characters)." }) : { ok: true, value: { name, address: str(r.address, 240) } };
}

export const MAX_LOCATIONS = 50;
export async function addLocation(workspaceId: string, l: { name: string; address: string }): Promise<{ ok: true; id: string } | { ok: false; error: "limit" }> {
  const [n] = await query<{ n: number }>("select count(*)::int as n from locations where workspace_id = $1", [workspaceId]);
  if (n.n >= MAX_LOCATIONS) return { ok: false, error: "limit" };
  const [r] = await query<{ id: string }>("insert into locations (workspace_id, name, address, is_primary) values ($1,$2,$3, not exists (select 1 from locations where workspace_id = $1)) returning id", [workspaceId, l.name, l.address]);
  return { ok: true, id: r.id };
}
export async function updateLocation(workspaceId: string, id: string, l: { name: string; address: string }): Promise<boolean> {
  if (!uuidRe.test(id)) return false;
  return (await query("update locations set name = $3, address = $4 where id = $1 and workspace_id = $2 returning id", [id, workspaceId, l.name, l.address])).length > 0;
}
export async function makePrimary(workspaceId: string, id: string): Promise<boolean> {
  if (!uuidRe.test(id)) return false;
  return tx(async (q) => {
    const [x] = await q.query("select 1 from locations where id = $1 and workspace_id = $2", [id, workspaceId]);
    if (!x) return false;
    await q.query("update locations set is_primary = false where workspace_id = $1 and is_primary", [workspaceId]);
    await q.query("update locations set is_primary = true where id = $1", [id]);
    return true;
  });
}
/** The primary location can't be removed (make another primary first). QR codes that used it keep working, with no location. */
export async function removeLocation(workspaceId: string, id: string): Promise<"ok" | "primary" | "not_found"> {
  if (!uuidRe.test(id)) return "not_found";
  const [l] = await query<{ is_primary: boolean }>("select is_primary from locations where id = $1 and workspace_id = $2", [id, workspaceId]);
  if (!l) return "not_found";
  if (l.is_primary) return "primary";
  await query("delete from locations where id = $1", [id]);
  return "ok";
}

/* ---------- plan usage ---------- */

export type Usage = { dynamicUsed: number; dynamicLimit: number | null; scansMonth: number; contacts: number; apiKeys: number; seats: number; storageUsed: number; storageQuota: number };
export async function usage(ws: Workspace): Promise<Usage> {
  const [r] = await query<{ dyn: number; scans: number; contacts: number; keys: number }>(
    `select (select count(*)::int from qr_codes where workspace_id = $1 and dynamic and status <> 'archived') as dyn,
            (select count(*)::int from scans where workspace_id = $1 and scanned_at >= date_trunc('month', now())) as scans,
            (select count(*)::int from contacts where workspace_id = $1) as contacts,
            (select count(*)::int from api_keys where workspace_id = $1 and revoked_at is null) as keys`,
    [ws.id],
  );
  const lim = dynamicLimit[ws.plan];
  return { dynamicUsed: r.dyn, dynamicLimit: Number.isFinite(lim) ? lim : null, scansMonth: r.scans, contacts: r.contacts, apiKeys: r.keys, seats: 1, storageUsed: await storageUsed(ws.id), storageQuota: quotaBytes(ws) };
}

/* ---------- data: retention, export, delete ---------- */

export async function saveRetention(workspaceId: string, months: number | null): Promise<void> {
  await query("update workspaces set retention_months = $2, purged_on = null where id = $1", [workspaceId, months]);
}

/** Deletes scans and leads older than the workspace's retention period. Returns what was removed. */
export async function purgeExpired(workspaceId: string, months: number | null): Promise<{ scans: number; leads: number }> {
  if (months === null) return { scans: 0, leads: 0 };
  const m = String(months);
  const scans = await query("delete from scans where workspace_id = $1 and scanned_at < now() - ($2 || ' months')::interval returning 1", [workspaceId, m]);
  const leads = await query("delete from leads where workspace_id = $1 and created_at < now() - ($2 || ' months')::interval returning 1", [workspaceId, m]);
  await query("update workspaces set purged_on = (now() at time zone 'Asia/Kolkata')::date where id = $1", [workspaceId]);
  return { scans: scans.length, leads: leads.length };
}

/** Runs the purge at most once a day, when the owner opens the app. */
export async function purgeIfDue(ws: Workspace): Promise<void> {
  if (ws.retentionMonths === null) return;
  const [r] = await query<{ due: boolean }>("select (purged_on is null or purged_on < (now() at time zone 'Asia/Kolkata')::date) as due from workspaces where id = $1", [ws.id]);
  if (r?.due) await purgeExpired(ws.id, ws.retentionMonths);
}

export const MAX_EXPORT_ROWS = 100_000;

/** One dataset as CSV. Your customers' data is yours: nothing here is hidden or capped below 100,000 rows. */
export async function exportCsv(workspaceId: string, key: ExportKey): Promise<string> {
  const id = [workspaceId, MAX_EXPORT_ROWS];
  switch (key) {
    case "contacts": {
      const r = await query<{ name: string; phone: string; email: string; source: string; tags: string[]; opt_in: boolean; visits: number; last_seen: Date }>("select name, phone, email, source, tags, opt_in, visits, last_seen from contacts where workspace_id = $1 order by created_at limit $2", id);
      return toCsv(["Name", "Phone", "Email", "Source", "Tags", "Opted in to offers", "Visits", "Last seen"], r.map((x) => [x.name, x.phone, x.email, x.source, x.tags.join(";"), x.opt_in ? "yes" : "no", x.visits, x.last_seen]));
    }
    case "leads": {
      const r = await query<{ created_at: Date; name: string; phone: string; email: string; interest: string; preferred_time: string; message: string; source: string; stage: string; owner: string; notes: string }>("select created_at, name, phone, email, interest, preferred_time, message, source, stage, owner, notes from leads where workspace_id = $1 order by created_at limit $2", id);
      return toCsv(["Created", "Name", "Phone", "Email", "Interested in", "Preferred time", "Message", "Source", "Stage", "Owner", "Notes"], r.map((x) => [x.created_at, x.name, x.phone, x.email, x.interest, x.preferred_time, x.message, x.source, x.stage, x.owner, x.notes]));
    }
    case "tickets": {
      const r = await query<{ seq: number; created_at: Date; title: string; category: string; priority: string; status: string; source: string; place: string; assignee: string; customer_name: string; customer_phone: string; resolved_at: Date | null }>("select seq, created_at, title, category, priority, status, source, place, assignee, customer_name, customer_phone, resolved_at from tickets where workspace_id = $1 order by seq limit $2", id);
      return toCsv(["Number", "Created", "Title", "Category", "Priority", "Status", "Source", "Place", "Assignee", "Customer", "Customer phone", "Resolved"], r.map((x) => [x.seq, x.created_at, x.title, x.category, x.priority, x.status, x.source, x.place, x.assignee, x.customer_name, x.customer_phone, x.resolved_at]));
    }
    case "bookings": {
      const r = await query<{ code: string; item: string; name: string; phone: string; starts_at: Date; qty: number; status: string; staff: string; created_at: Date }>("select b.code, i.name as item, b.name, b.phone, b.starts_at, b.qty, b.status, b.staff, b.created_at from bookings b join booking_items i on i.id = b.item_id where b.workspace_id = $1 order by b.starts_at limit $2", id);
      return toCsv(["Code", "Service or event", "Customer", "Phone", "Starts", "Tickets", "Status", "Staff", "Booked on"], r.map((x) => [x.code, x.item, x.name, x.phone, x.starts_at, x.qty, x.status, x.staff, x.created_at]));
    }
    case "reviews": {
      const r = await query<{ created_at: Date; rating: number; source: string; staff: string; lang: string; google_clicked: boolean }>("select created_at, rating, source, staff, lang, google_clicked from review_responses where workspace_id = $1 order by created_at limit $2", id);
      return toCsv(["Date", "Rating", "Placed at", "Staff", "Language", "Went to Google"], r.map((x) => [x.created_at, x.rating, x.source, x.staff, x.lang, x.google_clicked ? "yes" : "no"]));
    }
    case "scans": {
      const r = await query<{ scanned_at: Date; qr: string; city: string | null; device: string; lang: string }>("select s.scanned_at, q.name as qr, s.city, s.device, s.lang from scans s left join qr_codes q on q.id = s.qr_id where s.workspace_id = $1 order by s.scanned_at limit $2", id);
      return toCsv(["Scanned", "QR code", "City", "Device", "Language"], r.map((x) => [x.scanned_at, x.qr, x.city, x.device, x.lang]));
    }
  }
}

/** Deletes the owner and, through the foreign keys, every row that belongs to the workspace. */
export async function deleteWorkspace(workspaceId: string): Promise<void> {
  await deleteWorkspaceFiles(workspaceId); // objects in S3 are not removed by the database cascade
  await query("delete from users where id = (select owner_id from workspaces where id = $1)", [workspaceId]);
}
