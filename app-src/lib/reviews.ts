import "server-only";
import { query } from "@/lib/db";
import { effectiveStatus, googleReviewLink, type StoredStatus } from "@/lib/qr-types";
import { defaultSettings, type ReviewSettings } from "./review-settings";
import type { Lang } from "./review-i18n";
import { emitEvent } from "@/lib/webhooks";

/* ---------- settings ---------- */

type SettingsRow = {
  question: string;
  chips: string[];
  languages: Lang[];
  manager_phone: string;
  suggest_text: boolean;
  links: { label: string; url: string }[];
};

export async function getReviewSettings(workspaceId: string): Promise<ReviewSettings> {
  const [r] = await query<SettingsRow>("select question, chips, languages, manager_phone, suggest_text, links from review_settings where workspace_id = $1", [
    workspaceId,
  ]);
  if (!r) return defaultSettings;
  return { question: r.question, chips: r.chips, languages: r.languages, managerPhone: r.manager_phone, suggestText: r.suggest_text, links: r.links };
}

export async function saveReviewSettings(workspaceId: string, s: ReviewSettings): Promise<void> {
  await query(
    `insert into review_settings (workspace_id, question, chips, languages, manager_phone, suggest_text, links, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,now())
     on conflict (workspace_id) do update set question=$2, chips=$3, languages=$4, manager_phone=$5, suggest_text=$6, links=$7, updated_at=now()`,
    [workspaceId, s.question, s.chips, s.languages, s.managerPhone, s.suggestText, JSON.stringify(s.links)],
  );
}

/* ---------- the public rating page ---------- */

export type RatingPage = {
  qrId: string;
  workspaceId: string;
  locationId: string | null;
  code: string;
  business: string;
  location: string;
  googleUrl: string;
  source: string;
  staff: string;
  state: "active" | "unavailable";
  settings: ReviewSettings;
};

/** Everything the customer-facing page needs, looked up by the QR's short code. */
export async function getRatingPage(code: string): Promise<RatingPage | null> {
  const [r] = await query<{
    id: string;
    workspace_id: string;
    location_id: string | null;
    short_code: string;
    status: StoredStatus;
    starts_at: Date | null;
    ends_at: Date | null;
    config: Record<string, string>;
    business: string;
    location: string | null;
    suspended: boolean;
  }>(
    `select q.id, q.workspace_id, q.location_id, q.short_code, q.status, q.starts_at, q.ends_at, q.config,
            w.name as business, w.suspended,
            coalesce(l.name, case when (select count(*) from locations where workspace_id = w.id) = 1
                                  then (select name from locations where workspace_id = w.id limit 1) end) as location
       from qr_codes q
       join workspaces w on w.id = q.workspace_id
       left join locations l on l.id = q.location_id
      where q.short_code = $1 and q.type = 'review' and q.dynamic and q.status <> 'archived'`,
    [code],
  );
  if (!r) return null;
  return {
    qrId: r.id,
    workspaceId: r.workspace_id,
    locationId: r.location_id,
    code: r.short_code,
    business: r.business,
    location: r.location ?? "",
    googleUrl: googleReviewLink(r.config.googleUrl ?? "") ?? "",
    source: r.config.source ?? "",
    staff: r.config.staff ?? "",
    state: !r.suspended && effectiveStatus({ status: r.status, starts_at: r.starts_at, ends_at: r.ends_at }) === "active" ? "active" : "unavailable",
    settings: await getReviewSettings(r.workspace_id),
  };
}

/* ---------- writing responses (public, rate-limited by the caller) ---------- */

export async function recentResponsesBy(visitor: string, minutes = 60): Promise<number> {
  const [r] = await query<{ n: number }>(
    "select count(*)::int as n from review_responses where visitor = $1 and created_at > now() - ($2 || ' minutes')::interval",
    [visitor, String(minutes)],
  );
  return r.n;
}

export async function createResponse(p: {
  page: RatingPage;
  rating: number;
  lang: Lang;
  chips: string[];
  visitor: string;
}): Promise<string> {
  const [r] = await query<{ id: string }>(
    `insert into review_responses (workspace_id, qr_id, location_id, rating, chips, lang, source, staff, visitor)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [p.page.workspaceId, p.page.qrId, p.page.locationId, p.rating, p.chips, p.lang, p.page.source, p.page.staff, p.visitor],
  );
  await emitEvent(p.page.workspaceId, "review.received", { response_id: r.id, rating: p.rating, source: p.page.source, staff: p.page.staff });
  return r.id;
}

/** Only the visitor who created a response may update it. */
export async function markGoogleClicked(id: string, visitor: string): Promise<boolean> {
  const r = await query("update review_responses set google_clicked = true where id = $1 and visitor = $2 returning id", [id, visitor]);
  return r.length > 0;
}

export async function updateRating(id: string, visitor: string, rating: number): Promise<boolean> {
  const r = await query("update review_responses set rating = $3 where id = $1 and visitor = $2 returning id", [id, visitor, rating]);
  return r.length > 0;
}

export async function updateChips(id: string, visitor: string, chips: string[]): Promise<boolean> {
  const r = await query("update review_responses set chips = $3 where id = $1 and visitor = $2 returning id", [id, visitor, chips]);
  return r.length > 0;
}

export async function createFeedback(p: { responseId: string; visitor: string; message: string; phone: string; chips: string[] }): Promise<"ok" | "not_found" | "duplicate"> {
  const [resp] = await query<{ workspace_id: string; qr_id: string | null }>("select workspace_id, qr_id from review_responses where id = $1 and visitor = $2", [
    p.responseId,
    p.visitor,
  ]);
  if (!resp) return "not_found";
  const rows = await query(
    `insert into feedback (workspace_id, response_id, qr_id, message, phone, chips) values ($1,$2,$3,$4,$5,$6)
     on conflict (response_id) do nothing returning id`,
    [resp.workspace_id, p.responseId, resp.qr_id, p.message, p.phone, p.chips],
  );
  return rows.length ? "ok" : "duplicate";
}

/* ---------- the Reviews screen ---------- */

export type FeedbackStatus = "open" | "in_progress" | "resolved";
export type FeedbackItem = {
  id: string;
  message: string;
  phone: string;
  chips: string[];
  status: FeedbackStatus;
  createdAt: string;
  rating: number | null;
  source: string;
  staff: string;
  qrName: string | null;
  /** number of the ticket made from this note, if any */
  ticketSeq: number | null;
};

export async function listFeedback(workspaceId: string, limit = 100): Promise<FeedbackItem[]> {
  const rows = await query<{
    id: string;
    message: string;
    phone: string;
    chips: string[];
    status: FeedbackStatus;
    created_at: Date;
    rating: number | null;
    source: string | null;
    staff: string | null;
    qr_name: string | null;
    ticket_seq: number | null;
  }>(
    `select f.id, f.message, f.phone, f.chips, f.status, f.created_at, r.rating, r.source, r.staff, q.name as qr_name, t.seq as ticket_seq
       from feedback f
       left join review_responses r on r.id = f.response_id
       left join qr_codes q on q.id = f.qr_id
       left join tickets t on t.feedback_id = f.id
      where f.workspace_id = $1
      order by (f.status = 'resolved'), f.created_at desc limit $2`,
    [workspaceId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    message: r.message,
    phone: r.phone,
    chips: r.chips,
    status: r.status,
    createdAt: r.created_at.toISOString(),
    rating: r.rating,
    source: r.source ?? "",
    staff: r.staff ?? "",
    qrName: r.qr_name,
    ticketSeq: r.ticket_seq,
  }));
}

export async function setFeedbackStatus(workspaceId: string, id: string, status: FeedbackStatus): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const r = await query(
    `update feedback set status = $3, resolved_at = case when $3 = 'resolved' then now() else null end
      where id = $1 and workspace_id = $2 returning id`,
    [id, workspaceId, status],
  );
  return r.length > 0;
}

export async function openFeedbackCount(workspaceId: string): Promise<number> {
  const [r] = await query<{ n: number }>("select count(*)::int as n from feedback where workspace_id = $1 and status = 'open'", [workspaceId]);
  return r.n;
}

export type ResponseItem = {
  id: string;
  rating: number;
  chips: string[];
  lang: string;
  source: string;
  staff: string;
  googleClicked: boolean;
  gaveFeedback: boolean;
  createdAt: string;
  qrName: string | null;
};

export async function recentResponses(workspaceId: string, limit = 12): Promise<ResponseItem[]> {
  const rows = await query<{
    id: string;
    rating: number;
    chips: string[];
    lang: string;
    source: string;
    staff: string;
    google_clicked: boolean;
    has_feedback: boolean;
    created_at: Date;
    qr_name: string | null;
  }>(
    `select r.id, r.rating, r.chips, r.lang, r.source, r.staff, r.google_clicked, r.created_at, q.name as qr_name,
            exists (select 1 from feedback f where f.response_id = r.id) as has_feedback
       from review_responses r left join qr_codes q on q.id = r.qr_id
      where r.workspace_id = $1 order by r.created_at desc limit $2`,
    [workspaceId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    chips: r.chips,
    lang: r.lang,
    source: r.source,
    staff: r.staff,
    googleClicked: r.google_clicked,
    gaveFeedback: r.has_feedback,
    createdAt: r.created_at.toISOString(),
    qrName: r.qr_name,
  }));
}

export type ReviewStats = {
  count: number;
  prevCount: number;
  avg: number | null;
  prevAvg: number | null;
  /** index 0 = 1 star … 4 = 5 stars */
  distribution: number[];
  googleClicks: number;
  highRatings: number;
  highToGoogle: number;
  feedbackCount: number;
  feedbackResolved: number;
  feedbackOpen: number;
  topPositive: { name: string; n: number }[];
  topNegative: { name: string; n: number }[];
  staff: { name: string; n: number; avg: number }[];
};

/** Rating-page numbers for the last 30 days (and the 30 before, for comparison). */
export async function getReviewStats(workspaceId: string): Promise<ReviewStats> {
  const [cur, prev, dist, topPos, topNeg, staff, fb] = await Promise.all([
    query<{ n: number; avg: string | null; clicks: number; hi: number; hi_clicks: number }>(
      `select count(*)::int as n, avg(rating)::numeric(4,2)::text as avg,
              count(*) filter (where google_clicked)::int as clicks,
              count(*) filter (where rating >= 4)::int as hi,
              count(*) filter (where rating >= 4 and google_clicked)::int as hi_clicks
         from review_responses where workspace_id = $1 and created_at > now() - interval '30 days'`,
      [workspaceId],
    ),
    query<{ n: number; avg: string | null }>(
      `select count(*)::int as n, avg(rating)::numeric(4,2)::text as avg from review_responses
        where workspace_id = $1 and created_at <= now() - interval '30 days' and created_at > now() - interval '60 days'`,
      [workspaceId],
    ),
    query<{ rating: number; n: number }>(
      `select rating::int as rating, count(*)::int as n from review_responses
        where workspace_id = $1 and created_at > now() - interval '30 days' group by 1`,
      [workspaceId],
    ),
    query<{ name: string; n: number }>(
      `select c as name, count(*)::int as n from review_responses, unnest(chips) as c
        where workspace_id = $1 and rating >= 4 and created_at > now() - interval '30 days' group by 1 order by n desc, 1 limit 4`,
      [workspaceId],
    ),
    query<{ name: string; n: number }>(
      `select c as name, count(*)::int as n from feedback, unnest(chips) as c
        where workspace_id = $1 and created_at > now() - interval '30 days' group by 1 order by n desc, 1 limit 3`,
      [workspaceId],
    ),
    query<{ name: string; n: number; avg: string }>(
      `select staff as name, count(*)::int as n, avg(rating)::numeric(4,2)::text as avg from review_responses
        where workspace_id = $1 and staff <> '' and created_at > now() - interval '30 days' group by 1 order by n desc, 1 limit 10`,
      [workspaceId],
    ),
    query<{ n: number; resolved: number; open: number }>(
      `select count(*) filter (where created_at > now() - interval '30 days')::int as n,
              count(*) filter (where status = 'resolved' and created_at > now() - interval '30 days')::int as resolved,
              count(*) filter (where status = 'open')::int as open
         from feedback where workspace_id = $1`,
      [workspaceId],
    ),
  ]);
  const distribution = [0, 0, 0, 0, 0];
  for (const d of dist) distribution[d.rating - 1] = d.n;
  return {
    count: cur[0].n,
    prevCount: prev[0].n,
    avg: cur[0].avg === null ? null : Number(cur[0].avg),
    prevAvg: prev[0].avg === null ? null : Number(prev[0].avg),
    distribution,
    googleClicks: cur[0].clicks,
    highRatings: cur[0].hi,
    highToGoogle: cur[0].hi_clicks,
    feedbackCount: fb[0].n,
    feedbackResolved: fb[0].resolved,
    feedbackOpen: fb[0].open,
    topPositive: topPos,
    topNegative: topNeg,
    staff: staff.map((s) => ({ name: s.name, n: s.n, avg: Number(s.avg) })),
  };
}

/** Rating-page actions per QR code over a period, for the Analytics "Actions" and "Conversion" columns. */
export async function reviewActionsByQr(workspaceId: string, from: Date, to: Date) {
  const rows = await query<{ qr_id: string; ratings: number; google: number; feedback: number }>(
    `select r.qr_id, count(*)::int as ratings, count(*) filter (where r.google_clicked)::int as google,
            count(f.id)::int as feedback
       from review_responses r left join feedback f on f.response_id = r.id
      where r.workspace_id = $1 and r.created_at >= $2 and r.created_at < $3 and r.qr_id is not null group by r.qr_id`,
    [workspaceId, from, to],
  );
  return new Map(rows.map((r) => [r.qr_id, r]));
}
