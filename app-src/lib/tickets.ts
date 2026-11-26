import "server-only";
import { query, tx, type Queryable } from "@/lib/db";
import { upsertContact } from "@/lib/engage";
import { emitEvent } from "@/lib/webhooks";
import { DEFAULT_SLA, PRIORITIES, assetCode, dueState, istDay, istInstant, nextDue, type AssetInput, type DueState, type Priority, type ServiceLogInput, type SlaInput, type TicketInput, type TicketPatch, type TicketStatus } from "@/lib/ops-input";
import { newToken } from "@/lib/token";

const uuidRe = /^[0-9a-f-]{36}$/i;
export const isUuid = (v: string) => uuidRe.test(v);

/* ---------- SLA rules ---------- */

export async function getSla(workspaceId: string, q: Queryable = { query, exec: async () => {} }): Promise<SlaInput> {
  const rows = await q.query<{ priority: Priority; hours: number }>("select priority, hours from sla_rules where workspace_id = $1", [workspaceId]);
  const out = { ...DEFAULT_SLA };
  for (const r of rows) out[r.priority] = r.hours;
  return out;
}

export async function saveSla(workspaceId: string, s: SlaInput): Promise<void> {
  await tx(async (q) => {
    for (const p of PRIORITIES) {
      await q.query("insert into sla_rules (workspace_id, priority, hours) values ($1,$2,$3) on conflict (workspace_id, priority) do update set hours = excluded.hours", [workspaceId, p.key, s[p.key]]);
    }
    // open tickets follow the new rules
    await q.query(
      `update tickets t set due_at = t.created_at + (r.hours || ' hours')::interval, updated_at = now()
         from sla_rules r where r.workspace_id = t.workspace_id and r.priority = t.priority and t.workspace_id = $1 and t.status <> 'resolved'`,
      [workspaceId],
    );
  });
}

/* ---------- tickets ---------- */

export type TicketEvent = { id: number; kind: string; text: string; public: boolean; at: string };
export type TicketRecord = {
  id: string;
  seq: number;
  title: string;
  category: string;
  priority: Priority;
  status: TicketStatus;
  source: string;
  place: string;
  assignee: string;
  customerName: string;
  customerPhone: string;
  details: string;
  assetName: string;
  assetId: string | null;
  dueAt: string;
  createdAt: string;
  resolvedAt: string | null;
  token: string;
  /** past its SLA deadline and still not resolved (or resolved late) */
  breached: boolean;
};

type TicketRow = {
  id: string; seq: number; title: string; category: string; priority: Priority; status: TicketStatus; source: string; place: string; assignee: string;
  customer_name: string; customer_phone: string; details: string; asset_name: string | null; asset_id: string | null; due_at: Date; created_at: Date; resolved_at: Date | null; token: string;
};
const TICKET_SELECT = `
  select t.id, t.seq, t.title, t.category, t.priority, t.status, t.source, t.place, t.assignee, t.customer_name, t.customer_phone, t.details,
         a.name as asset_name, t.asset_id, t.due_at, t.created_at, t.resolved_at, t.token
    from tickets t left join assets a on a.id = t.asset_id`;
const toTicket = (r: TicketRow): TicketRecord => ({
  id: r.id, seq: r.seq, title: r.title, category: r.category, priority: r.priority, status: r.status, source: r.source, place: r.place, assignee: r.assignee,
  customerName: r.customer_name, customerPhone: r.customer_phone, details: r.details, assetName: r.asset_name ?? "", assetId: r.asset_id,
  dueAt: r.due_at.toISOString(), createdAt: r.created_at.toISOString(), resolvedAt: r.resolved_at?.toISOString() ?? null, token: r.token,
  breached: (r.resolved_at ?? new Date()).getTime() > r.due_at.getTime(),
});

export type NewTicket = TicketInput & { source: string; qrId?: string | null; assetId?: string | null; feedbackId?: string | null; visitor?: string };

export async function createTicket(workspaceId: string, t: NewTicket): Promise<{ id: string; seq: number; token: string }> {
  const made = await tx(async (q) => {
    const [w] = await q.query<{ ticket_seq: number }>("update workspaces set ticket_seq = ticket_seq + 1 where id = $1 returning ticket_seq", [workspaceId]);
    const hours = (await getSla(workspaceId, q))[t.priority];
    const token = newToken("t");
    const [r] = await q.query<{ id: string }>(
      `insert into tickets (workspace_id, seq, title, category, priority, source, qr_id, asset_id, feedback_id, place, customer_name, customer_phone, details, assignee, token, visitor, due_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, now() + ($17 || ' hours')::interval) returning id`,
      [workspaceId, w.ticket_seq, t.title, t.category, t.priority, t.source, t.qrId ?? null, t.assetId ?? null, t.feedbackId ?? null, t.place, t.customerName, t.customerPhone, t.details, t.assignee, token, t.visitor ?? "", String(hours)],
    );
    if (t.customerPhone) await upsertContact(q, workspaceId, { name: t.customerName, phone: t.customerPhone, source: "Ticket" });
    await q.query("insert into ticket_events (ticket_id, workspace_id, kind, text, public) values ($1,$2,'created',$3,true)", [r.id, workspaceId, `Ticket created · SLA ${hours} h`]);
    if (t.assignee) await q.query("insert into ticket_events (ticket_id, workspace_id, kind, text) values ($1,$2,'assign',$3)", [r.id, workspaceId, `Assigned to ${t.assignee}`]);
    return { id: r.id, seq: w.ticket_seq, token };
  });
  await emitEvent(workspaceId, "ticket.created", { ticket_id: made.id, number: made.seq, title: t.title, category: t.category, source: t.source, place: t.place });
  return made;
}

export async function listTickets(workspaceId: string, opts: { scope?: "active" | "all" | "resolved"; category?: string; limit?: number } = {}): Promise<TicketRecord[]> {
  const where = ["t.workspace_id = $1"];
  const params: unknown[] = [workspaceId];
  if (opts.scope === "resolved") where.push("t.status = 'resolved'");
  else if (opts.scope !== "all") where.push("t.status <> 'resolved'");
  if (opts.category) {
    params.push(opts.category);
    where.push(`t.category = $${params.length}`);
  }
  params.push(opts.limit ?? 200);
  const rows = await query<TicketRow>(`${TICKET_SELECT} where ${where.join(" and ")} order by (t.status = 'resolved'), t.due_at asc, t.created_at desc limit $${params.length}`, params);
  return rows.map(toTicket);
}

export async function getTicket(workspaceId: string, id: string): Promise<{ ticket: TicketRecord; events: TicketEvent[] } | null> {
  if (!isUuid(id)) return null;
  const [r] = await query<TicketRow>(`${TICKET_SELECT} where t.id = $1 and t.workspace_id = $2`, [id, workspaceId]);
  if (!r) return null;
  const ev = await query<{ id: number; kind: string; text: string; public: boolean; created_at: Date }>("select id, kind, text, public, created_at from ticket_events where ticket_id = $1 order by created_at, id", [id]);
  return { ticket: toTicket(r), events: ev.map((e) => ({ id: e.id, kind: e.kind, text: e.text, public: e.public, at: e.created_at.toISOString() })) };
}

export async function updateTicket(workspaceId: string, id: string, p: TicketPatch): Promise<boolean> {
  if (!isUuid(id)) return false;
  return tx(async (q) => {
    const [t] = await q.query<{ status: TicketStatus; priority: Priority; assignee: string; created_at: Date }>("select status, priority, assignee, created_at from tickets where id = $1 and workspace_id = $2 for update", [id, workspaceId]);
    if (!t) return false;
    const ev = (kind: string, text: string, pub = false) => q.query("insert into ticket_events (ticket_id, workspace_id, kind, text, public) values ($1,$2,$3,$4,$5)", [id, workspaceId, kind, text, pub]);
    if (p.priority && p.priority !== t.priority) {
      const hours = (await getSla(workspaceId, q))[p.priority];
      await q.query("update tickets set priority = $2, due_at = created_at + ($3 || ' hours')::interval, updated_at = now() where id = $1", [id, p.priority, String(hours)]);
      await ev("priority", `Priority set to ${p.priority} · SLA ${hours} h`);
    }
    if (p.assignee !== undefined && p.assignee !== t.assignee) {
      await q.query("update tickets set assignee = $2, updated_at = now() where id = $1", [id, p.assignee]);
      await ev("assign", p.assignee ? `Assigned to ${p.assignee}` : "Unassigned");
    }
    if (p.status && p.status !== t.status) {
      await q.query("update tickets set status = $2, resolved_at = case when $2 = 'resolved' then now() else null end, updated_at = now() where id = $1", [id, p.status]);
      await ev("status", p.status === "resolved" ? "Marked resolved" : p.status === "in_progress" ? "Work started" : "Reopened", true);
    }
    if (p.note) await ev("note", p.note);
    if (p.reply) await ev("reply", p.reply, true);
    return true;
  });
}

export type TicketStats = { open: number; newToday: number; breaching: number; avgResolutionMin: number | null; resolved30: number; withinSla30: number | null };
export async function ticketStats(workspaceId: string): Promise<TicketStats> {
  const [r] = await query<{ open: number; new_today: number; breaching: number; avg_min: number | null; resolved30: number; within: number }>(
    `select count(*) filter (where status <> 'resolved')::int as open,
            count(*) filter (where created_at >= $2)::int as new_today,
            count(*) filter (where status <> 'resolved' and due_at < now())::int as breaching,
            (avg(extract(epoch from (resolved_at - created_at)) / 60) filter (where status = 'resolved' and resolved_at > now() - interval '30 days'))::float as avg_min,
            count(*) filter (where status = 'resolved' and resolved_at > now() - interval '30 days')::int as resolved30,
            count(*) filter (where status = 'resolved' and resolved_at > now() - interval '30 days' and resolved_at <= due_at)::int as within
       from tickets where workspace_id = $1`,
    [workspaceId, istInstant(istDay(), 0)],
  );
  return { open: r.open, newToday: r.new_today, breaching: r.breaching, avgResolutionMin: r.avg_min === null ? null : Math.round(r.avg_min), resolved30: r.resolved30, withinSla30: r.resolved30 ? Math.round((r.within / r.resolved30) * 100) : null };
}

/** For the sidebar badge: tickets that are not resolved. */
export async function openTicketCount(workspaceId: string): Promise<number> {
  const [r] = await query<{ n: number }>("select count(*)::int as n from tickets where workspace_id = $1 and status <> 'resolved'", [workspaceId]);
  return r.n;
}

/** What a customer sees on their own ticket link: status and the replies meant for them. */
export async function getTicketByToken(token: string) {
  if (!/^t[A-Za-z0-9_-]{22}$/.test(token)) return null;
  const [t] = await query<{ id: string; seq: number; title: string; status: TicketStatus; place: string; created_at: Date; business: string; logo: string | null }>(
    "select t.id, t.seq, t.title, t.status, t.place, t.created_at, w.name as business, w.logo_file_id as logo from tickets t join workspaces w on w.id = t.workspace_id where t.token = $1",
    [token],
  );
  if (!t) return null;
  const ev = await query<{ kind: string; text: string; created_at: Date }>("select kind, text, created_at from ticket_events where ticket_id = $1 and public order by created_at, id", [t.id]);
  return { seq: t.seq, title: t.title, status: t.status, place: t.place, createdAt: t.created_at.toISOString(), business: t.business, logoId: t.logo, events: ev.map((e) => ({ kind: e.kind, text: e.text, at: e.created_at.toISOString() })) };
}

/** Turns a private-feedback item from the Reviews inbox into a ticket (once). */
export async function ticketFromFeedback(workspaceId: string, feedbackId: string): Promise<{ ok: true; seq: number; created: boolean } | { ok: false }> {
  if (!isUuid(feedbackId)) return { ok: false };
  const existing = await query<{ seq: number }>("select seq from tickets where feedback_id = $1 and workspace_id = $2", [feedbackId, workspaceId]);
  if (existing[0]) return { ok: true, seq: existing[0].seq, created: false };
  const [f] = await query<{ message: string; phone: string; qr_id: string | null; place: string | null; chips: string[] }>(
    `select f.message, f.phone, f.qr_id, coalesce(nullif(q.config->>'source', ''), q.name) as place, f.chips
       from feedback f left join qr_codes q on q.id = f.qr_id where f.id = $1 and f.workspace_id = $2`,
    [feedbackId, workspaceId],
  );
  if (!f) return { ok: false };
  const title = f.message.length > 80 ? `${f.message.slice(0, 77)}…` : f.message;
  try {
    const t = await createTicket(workspaceId, { title, category: "Feedback", priority: "normal", place: f.place ?? "", details: f.chips.length ? `${f.message}\n\nTopics: ${f.chips.join(", ")}` : f.message, customerName: "", customerPhone: f.phone, assignee: "", source: "review", qrId: f.qr_id, feedbackId });
    await query("update feedback set status = 'in_progress' where id = $1 and status = 'open'", [feedbackId]);
    return { ok: true, seq: t.seq, created: true };
  } catch {
    const again = await query<{ seq: number }>("select seq from tickets where feedback_id = $1 and workspace_id = $2", [feedbackId, workspaceId]);
    return again[0] ? { ok: true, seq: again[0].seq, created: false } : { ok: false };
  }
}

/* ---------- assets ---------- */

export type AssetRecord = {
  id: string; seq: number; code: string; name: string; place: string; vendor: string; intervalDays: number | null;
  lastService: string | null; nextDue: string | null; due: DueState; active: boolean; openTickets: number; inUse: number; scans30: number;
};
type AssetRow = { id: string; seq: number; name: string; place: string; vendor: string; interval_days: number | null; last_service: string | null; next_due: string | null; active: boolean; open_tickets: number; in_use: number; scans30: number };
const ASSET_SELECT = `
  select a.id, a.seq, a.name, a.place, a.vendor, a.interval_days, a.last_service::text as last_service, a.next_due::text as next_due, a.active,
         (select count(*)::int from tickets t where t.asset_id = a.id and t.status <> 'resolved') as open_tickets,
         (select count(*)::int from qr_codes q where q.workspace_id = a.workspace_id and q.status <> 'archived' and q.config->>'assetId' = a.id::text) as in_use,
         (select count(*)::int from scans s join qr_codes q on q.id = s.qr_id where q.workspace_id = a.workspace_id and q.config->>'assetId' = a.id::text and s.scanned_at > now() - interval '30 days') as scans30
    from assets a`;
const toAsset = (r: AssetRow): AssetRecord => ({
  id: r.id, seq: r.seq, code: assetCode(r.seq), name: r.name, place: r.place, vendor: r.vendor, intervalDays: r.interval_days, lastService: r.last_service, nextDue: r.next_due,
  due: dueState(r.next_due), active: r.active, openTickets: r.open_tickets, inUse: r.in_use, scans30: r.scans30,
});

export async function listAssets(workspaceId: string): Promise<AssetRecord[]> {
  const rows = await query<AssetRow>(`${ASSET_SELECT} where a.workspace_id = $1 and a.active order by a.seq`, [workspaceId]);
  return rows.map(toAsset);
}
export async function getAsset(workspaceId: string, id: string): Promise<AssetRecord | null> {
  if (!isUuid(id)) return null;
  const [r] = await query<AssetRow>(`${ASSET_SELECT} where a.id = $1 and a.workspace_id = $2 and a.active`, [id, workspaceId]);
  return r ? toAsset(r) : null;
}

export async function createAsset(workspaceId: string, a: AssetInput): Promise<string> {
  return tx(async (q) => {
    const [w] = await q.query<{ asset_seq: number }>("update workspaces set asset_seq = asset_seq + 1 where id = $1 returning asset_seq", [workspaceId]);
    const [r] = await q.query<{ id: string }>(
      `insert into assets (workspace_id, seq, name, place, vendor, interval_days, last_service, next_due) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [workspaceId, w.asset_seq, a.name, a.place, a.vendor, a.intervalDays, a.lastService, nextDue(a.lastService, a.intervalDays)],
    );
    return r.id;
  });
}

export async function updateAsset(workspaceId: string, id: string, a: AssetInput): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = await query(
    `update assets set name=$3, place=$4, vendor=$5, interval_days=$6, last_service=$7, next_due=$8 where id=$1 and workspace_id=$2 and active returning id`,
    [id, workspaceId, a.name, a.place, a.vendor, a.intervalDays, a.lastService, nextDue(a.lastService, a.intervalDays)],
  );
  return rows.length > 0;
}

/** Retires an asset. Refused while a live QR code points at it. Its tickets and service history stay. */
export async function retireAsset(workspaceId: string, id: string): Promise<"ok" | "in_use" | "not_found"> {
  if (!isUuid(id)) return "not_found";
  const [a] = await query("select 1 from assets where id = $1 and workspace_id = $2 and active", [id, workspaceId]);
  if (!a) return "not_found";
  const [u] = await query<{ n: number }>("select count(*)::int as n from qr_codes where workspace_id = $1 and status <> 'archived' and config->>'assetId' = $2", [workspaceId, id]);
  if (u.n > 0) return "in_use";
  await query("update assets set active = false where id = $1", [id]);
  return "ok";
}

export type ServiceEntry = { id: string; assetId: string; assetName: string; code: string; servicedOn: string; byName: string; notes: string };
export async function logService(workspaceId: string, assetId: string, s: ServiceLogInput): Promise<boolean> {
  if (!isUuid(assetId)) return false;
  return tx(async (q) => {
    const [a] = await q.query<{ interval_days: number | null; last_service: string | null }>("select interval_days, last_service::text as last_service from assets where id = $1 and workspace_id = $2 and active for update", [assetId, workspaceId]);
    if (!a) return false;
    await q.query("insert into asset_services (workspace_id, asset_id, serviced_on, by_name, notes) values ($1,$2,$3,$4,$5)", [workspaceId, assetId, s.servicedOn, s.byName, s.notes]);
    const last = a.last_service && a.last_service > s.servicedOn ? a.last_service : s.servicedOn;
    await q.query("update assets set last_service = $2, next_due = $3 where id = $1", [assetId, last, nextDue(last, a.interval_days)]);
    return true;
  });
}

export async function recentServices(workspaceId: string, limit = 60): Promise<ServiceEntry[]> {
  const rows = await query<{ id: string; asset_id: string; name: string; seq: number; serviced_on: string; by_name: string; notes: string }>(
    `select s.id, s.asset_id, a.name, a.seq, s.serviced_on::text as serviced_on, s.by_name, s.notes
       from asset_services s join assets a on a.id = s.asset_id where s.workspace_id = $1 order by s.serviced_on desc, s.created_at desc limit $2`,
    [workspaceId, limit],
  );
  return rows.map((r) => ({ id: r.id, assetId: r.asset_id, assetName: r.name, code: assetCode(r.seq), servicedOn: r.serviced_on, byName: r.by_name, notes: r.notes }));
}

export async function assetCounts(workspaceId: string): Promise<{ assets: number; dueThisWeek: number; overdue: number; services: number }> {
  const today = istDay();
  const [r] = await query<{ assets: number; due: number; overdue: number; services: number }>(
    `select (select count(*)::int from assets where workspace_id = $1 and active) as assets,
            (select count(*)::int from assets where workspace_id = $1 and active and next_due >= $2::date and next_due <= $2::date + 7) as due,
            (select count(*)::int from assets where workspace_id = $1 and active and next_due < $2::date) as overdue,
            (select count(*)::int from asset_services where workspace_id = $1) as services`,
    [workspaceId, today],
  );
  return { assets: r.assets, dueThisWeek: r.due, overdue: r.overdue, services: r.services };
}

/** Page data for an Asset QR: the asset, if it is still active. */
export async function assetForQr(workspaceId: string, assetId: string) {
  const a = await getAsset(workspaceId, assetId);
  return a ? { id: a.id, code: a.code, name: a.name, place: a.place, lastService: a.lastService } : null;
}
