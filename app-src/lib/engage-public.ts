import "server-only";
import { query } from "@/lib/db";
import { SCAN_PAGE_TYPES, effectiveStatus, type StoredStatus } from "@/lib/qr-types";
import { getCoupon, getForm, getProgram, getPublishedPage, type CouponRecord, type FormRecord, type ProgramRecord } from "@/lib/engage";
import { getPoint } from "@/lib/attendance";
import { getItem, seatsLeft } from "@/lib/bookings";
import { assetForQr } from "@/lib/tickets";
import { publicPlot } from "@/lib/realestate";
import type { PageContent, PageKind } from "@/lib/pages";

export type EngageQr = {
  id: string;
  workspaceId: string;
  type: string;
  name: string;
  code: string;
  config: Record<string, string>;
  business: string;
  logoId: string | null;
  location: string;
  active: boolean;
};

/** A published Engage QR (menu, lead, coupon, loyalty, card, bio) by short code. */
export async function getEngageQr(code: string, type?: string): Promise<EngageQr | null> {
  const [r] = await query<{
    id: string;
    workspace_id: string;
    type: string;
    name: string;
    short_code: string;
    status: StoredStatus;
    starts_at: Date | null;
    ends_at: Date | null;
    config: Record<string, string>;
    business: string;
    logo_file_id: string | null;
    location: string | null;
    suspended: boolean;
  }>(
    `select q.id, q.workspace_id, q.type, q.name, q.short_code, q.status, q.starts_at, q.ends_at, q.config, w.name as business, w.logo_file_id, w.suspended,
            coalesce(l.name, case when (select count(*) from locations where workspace_id = w.id) = 1
                                  then (select name from locations where workspace_id = w.id limit 1) end) as location
       from qr_codes q join workspaces w on w.id = q.workspace_id left join locations l on l.id = q.location_id
      where q.short_code = $1 and q.dynamic and q.status <> 'archived' and q.type = any($2::text[])`,
    [code, type ? [type] : SCAN_PAGE_TYPES],
  );
  if (!r) return null;
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    type: r.type,
    name: r.name,
    code: r.short_code,
    config: r.config,
    business: r.business,
    logoId: r.logo_file_id,
    location: r.location ?? "",
    active: !r.suspended && effectiveStatus({ status: r.status, starts_at: r.starts_at, ends_at: r.ends_at }) === "active",
  };
}

export type PublicEngage =
  | { unavailable: true; business: string }
  | { unavailable?: false; qr: EngageQr; type: "menu" | "vcard" | "bio"; page: { id: string; kind: PageKind; title: string; content: PageContent } }
  | { unavailable?: false; qr: EngageQr; type: "lead"; form: FormRecord }
  | { unavailable?: false; qr: EngageQr; type: "coupon"; coupon: CouponRecord }
  | { unavailable?: false; qr: EngageQr; type: "loyalty"; program: ProgramRecord }
  | { unavailable?: false; qr: EngageQr; type: "ticket"; place: string }
  | { unavailable?: false; qr: EngageQr; type: "asset"; asset: { id: string; code: string; name: string; place: string; lastService: string | null } }
  | { unavailable?: false; qr: EngageQr; type: "attend"; point: { name: string; requireGeo: boolean } }
  | { unavailable?: false; qr: EngageQr; type: "visitor"; place: string }
  | { unavailable?: false; qr: EngageQr; type: "booking"; item: PublicBookable }
  | { unavailable?: false; qr: EngageQr; type: "plot"; plot: NonNullable<Awaited<ReturnType<typeof publicPlot>>> };

export type PublicBookable = {
  id: string; kind: "service" | "event"; name: string; description: string; durationMin: number | null; price: number | null; staff: string[];
  needsApproval: boolean; startsAt: string | null; venue: string; seatsLeft: number | null;
};

/** Everything a customer page needs for one code, or "unavailable" when the thing it points at is gone or not live. */
export async function loadPublicEngage(code: string): Promise<PublicEngage | null> {
  const qr = await getEngageQr(code);
  if (!qr) return null;
  const gone = { unavailable: true as const, business: qr.business };
  if (!qr.active) return gone;
  switch (qr.type) {
    case "menu":
    case "vcard":
    case "bio": {
      const page = await getPublishedPage(qr.workspaceId, qr.config.pageId ?? "");
      return page ? { qr, type: qr.type, page } : gone;
    }
    case "lead": {
      const form = await getForm(qr.workspaceId, qr.config.formId ?? "");
      return form ? { qr, type: "lead", form } : gone;
    }
    case "coupon": {
      const coupon = await getCoupon(qr.workspaceId, qr.config.couponId ?? "");
      return coupon ? { qr, type: "coupon", coupon } : gone;
    }
    case "loyalty": {
      const program = await getProgram(qr.workspaceId);
      return program && program.active ? { qr, type: "loyalty", program } : gone;
    }
    case "ticket":
      return { qr, type: "ticket", place: qr.config.place ?? "" };
    case "asset": {
      const asset = await assetForQr(qr.workspaceId, qr.config.assetId ?? "");
      return asset ? { qr, type: "asset", asset } : gone;
    }
    case "attend": {
      const point = await getPoint(qr.workspaceId, qr.config.pointId ?? "");
      return point ? { qr, type: "attend", point: { name: point.name, requireGeo: point.requireGeo && point.lat !== null } } : gone;
    }
    case "visitor":
      return { qr, type: "visitor", place: qr.config.place ?? "" };
    case "booking": {
      const it = await getItem(qr.workspaceId, qr.config.itemId ?? "");
      if (!it) return gone;
      const left = it.kind === "event" ? await seatsLeft(it.id) : null;
      return { qr, type: "booking", item: { id: it.id, kind: it.kind, name: it.name, description: it.description, durationMin: it.durationMin, price: it.price, staff: it.staff, needsApproval: it.needsApproval, startsAt: it.startsAt, venue: it.venue, seatsLeft: left } };
    }
    case "plot": {
      const plot = await publicPlot(qr.workspaceId, qr.config.plotId ?? "");
      return plot ? { qr, type: "plot", plot } : gone;
    }
  }
  return gone;
}
