import "server-only";
import { query } from "@/lib/db";
import {
  typeByKey,
  dynamicLimit,
  effectiveStatus,
  randomShortCode,
  type EffectiveStatus,
  type QrDesign,
  type QrInput,
  type StoredStatus,
} from "@/lib/qr-types";
import type { Workspace } from "@/lib/workspace";

export type QrRecord = {
  id: string;
  name: string;
  type: string;
  dynamic: boolean;
  shortCode: string | null;
  status: StoredStatus;
  effective: EffectiveStatus;
  config: Record<string, string>;
  design: QrDesign;
  startsAt: string | null;
  endsAt: string | null;
  locationId: string | null;
  locationName: string | null;
  folderId: string | null;
  folderName: string | null;
  createdAt: string;
  scans30: number;
};

type Row = {
  id: string;
  name: string;
  type: string;
  dynamic: boolean;
  short_code: string | null;
  status: StoredStatus;
  config: Record<string, string>;
  design: QrDesign;
  starts_at: Date | null;
  ends_at: Date | null;
  location_id: string | null;
  location_name: string | null;
  folder_id: string | null;
  folder_name: string | null;
  created_at: Date;
  scans30: number;
};

const SELECT = `
  select q.id, q.name, q.type, q.dynamic, q.short_code, q.status, q.config, q.design,
         q.starts_at, q.ends_at, q.location_id, l.name as location_name,
         q.folder_id, f.name as folder_name, q.created_at,
         (select count(*)::int from scans s where s.qr_id = q.id and s.scanned_at > now() - interval '30 days') as scans30
    from qr_codes q
    left join locations l on l.id = q.location_id
    left join folders f on f.id = q.folder_id`;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function toRecord(r: Row): QrRecord {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    dynamic: r.dynamic,
    shortCode: r.short_code,
    status: r.status,
    effective: effectiveStatus({ status: r.status, starts_at: r.starts_at, ends_at: r.ends_at }),
    config: r.config,
    design: r.design,
    startsAt: iso(r.starts_at),
    endsAt: iso(r.ends_at),
    locationId: r.location_id,
    locationName: r.location_name,
    folderId: r.folder_id,
    folderName: r.folder_name,
    createdAt: r.created_at.toISOString(),
    scans30: r.scans30,
  };
}

export async function listQrCodes(workspaceId: string): Promise<QrRecord[]> {
  const rows = await query<Row>(`${SELECT} where q.workspace_id = $1 order by q.created_at desc`, [workspaceId]);
  return rows.map(toRecord);
}

export async function getQrCode(workspaceId: string, id: string): Promise<QrRecord | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await query<Row>(`${SELECT} where q.workspace_id = $1 and q.id = $2`, [workspaceId, id]);
  return r ? toRecord(r) : null;
}

export async function countDynamic(workspaceId: string): Promise<number> {
  const [r] = await query<{ n: number }>("select count(*)::int as n from qr_codes where workspace_id = $1 and dynamic and status <> 'archived'", [
    workspaceId,
  ]);
  return r.n;
}

const isUnique = (e: unknown) =>
  (e as { code?: string })?.code === "23505" || /duplicate key|unique constraint/i.test((e as Error)?.message ?? "");

export type SaveError = "plan_limit" | "slug_taken" | "bad_location" | "bad_folder" | "not_found" | "bad_ref";
export type SaveResult = { ok: true; id: string; shortCode: string | null; status: StoredStatus } | { ok: false; error: SaveError; fields?: Record<string, string> };

async function ownedBy(table: "locations" | "folders", id: string | null, workspaceId: string) {
  if (!id) return true;
  const r = await query(`select 1 from ${table} where id = $1 and workspace_id = $2`, [id, workspaceId]);
  return r.length > 0;
}

/** The page, form, coupon or programme a code points at must exist in the same workspace. */
async function checkRefs(workspaceId: string, type: string, config: Record<string, string>, publish: boolean): Promise<Record<string, string> | null> {
  const def = typeByKey(type);
  const bad: Record<string, string> = {};
  for (const f of def?.fields ?? []) {
    if (f.kind !== "ref") continue;
    const v = config[f.key];
    if (!v) continue;
    let exists = false;
    if (f.ref === "loyalty") exists = (await query("select 1 from loyalty_programs where workspace_id = $1", [workspaceId])).length > 0;
    else if (f.ref === "form") exists = (await query("select 1 from lead_forms where id = $1 and workspace_id = $2", [v, workspaceId])).length > 0;
    else if (f.ref === "coupon") exists = (await query("select 1 from coupons where id = $1 and workspace_id = $2", [v, workspaceId])).length > 0;
    else if (f.ref === "asset") exists = (await query("select 1 from assets where id = $1 and workspace_id = $2 and active", [v, workspaceId])).length > 0;
    else if (f.ref === "point") exists = (await query("select 1 from attend_points where id = $1 and workspace_id = $2", [v, workspaceId])).length > 0;
    else if (f.ref === "bookable") exists = (await query("select 1 from booking_items where id = $1 and workspace_id = $2 and active", [v, workspaceId])).length > 0;
    else if (f.ref === "plot") exists = (await query("select 1 from plots where id = $1 and workspace_id = $2", [v, workspaceId])).length > 0;
    else if (f.ref?.startsWith("page:")) {
      const rows = await query<{ status: string }>("select status from pages where id = $1 and workspace_id = $2 and kind = $3", [v, workspaceId, f.ref.slice(5)]);
      exists = rows.length > 0 && (!publish || rows[0].status === "published");
      if (rows.length > 0 && publish && rows[0].status !== "published") {
        bad[`config.${f.key}`] = "Publish that page first. A code can only point at a published page.";
        continue;
      }
    }
    if (!exists) bad[`config.${f.key}`] = `That ${f.label.toLowerCase()} no longer exists. Choose another.`;
  }
  return Object.keys(bad).length ? bad : null;
}

export async function createQrCode(ws: Workspace, input: QrInput, publish: boolean): Promise<SaveResult> {
  if (!(await ownedBy("locations", input.locationId, ws.id))) return { ok: false, error: "bad_location" };
  if (!(await ownedBy("folders", input.folderId, ws.id))) return { ok: false, error: "bad_folder" };
  const refErr = await checkRefs(ws.id, input.type, input.config, publish);
  if (refErr) return { ok: false, error: "bad_ref", fields: refErr };
  if (input.dynamic && (await countDynamic(ws.id)) >= (dynamicLimit[ws.plan] ?? 0)) return { ok: false, error: "plan_limit" };

  const custom = input.shortCode;
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = input.dynamic ? (custom ?? randomShortCode()) : null;
    try {
      const [r] = await query<{ id: string }>(
        `insert into qr_codes (workspace_id, location_id, folder_id, name, type, dynamic, short_code, status, config, design, starts_at, ends_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
        [
          ws.id,
          input.locationId,
          input.folderId,
          input.name,
          input.type,
          input.dynamic,
          code,
          publish ? "active" : "draft",
          JSON.stringify(input.config),
          JSON.stringify(input.design),
          input.startsAt,
          input.endsAt,
        ],
      );
      return { ok: true, id: r.id, shortCode: code, status: publish ? "active" : "draft" };
    } catch (e) {
      if (!isUnique(e)) throw e;
      if (custom) return { ok: false, error: "slug_taken" };
      // random code collided: try another
    }
  }
  throw new Error("Could not allocate a unique short code");
}

/** Updates an existing code. Type, dynamic/static and short code never change after creation. */
export async function updateQrCode(ws: Workspace, id: string, input: QrInput, publish: boolean | undefined): Promise<SaveResult> {
  const existing = await getQrCode(ws.id, id);
  if (!existing || existing.status === "archived") return { ok: false, error: "not_found" };
  if (!(await ownedBy("locations", input.locationId, ws.id))) return { ok: false, error: "bad_location" };
  if (!(await ownedBy("folders", input.folderId, ws.id))) return { ok: false, error: "bad_folder" };
  const goingLive = (publish && existing.status === "draft") || existing.status === "active";
  const refErr = await checkRefs(ws.id, input.type, input.config, goingLive);
  if (refErr) return { ok: false, error: "bad_ref", fields: refErr };
  const status: StoredStatus = publish && existing.status === "draft" ? "active" : existing.status;
  await query(
    `update qr_codes set name=$3, location_id=$4, folder_id=$5, config=$6, design=$7, starts_at=$8, ends_at=$9, status=$10, updated_at=now()
      where id=$1 and workspace_id=$2`,
    [id, ws.id, input.name, input.locationId, input.folderId, JSON.stringify(input.config), JSON.stringify(input.design), input.startsAt, input.endsAt, status],
  );
  return { ok: true, id, shortCode: existing.shortCode, status };
}

export type BulkAction = "pause" | "resume" | "archive" | "restore" | "move";

export async function bulkAction(
  ws: Workspace,
  ids: string[],
  action: BulkAction,
  folderId: string | null,
): Promise<{ ok: true; changed: number } | { ok: false; error: SaveError }> {
  const clean = ids.filter((i) => /^[0-9a-f-]{36}$/i.test(i)).slice(0, 500);
  if (clean.length === 0) return { ok: true, changed: 0 };
  const p = [ws.id, clean];
  let rows: unknown[] = [];
  switch (action) {
    case "pause":
      rows = await query("update qr_codes set status='paused', updated_at=now() where workspace_id=$1 and id = any($2::uuid[]) and status='active' returning id", p);
      break;
    case "resume":
      rows = await query("update qr_codes set status='active', updated_at=now() where workspace_id=$1 and id = any($2::uuid[]) and status='paused' returning id", p);
      break;
    case "archive":
      rows = await query("update qr_codes set status='archived', updated_at=now() where workspace_id=$1 and id = any($2::uuid[]) and status<>'archived' returning id", p);
      break;
    case "restore": {
      // restored codes come back paused so nothing goes live unexpectedly; respect the dynamic-code limit
      const [need] = await query<{ n: number }>("select count(*)::int as n from qr_codes where workspace_id=$1 and id = any($2::uuid[]) and status='archived' and dynamic", p);
      if (need.n > 0 && (await countDynamic(ws.id)) + need.n > (dynamicLimit[ws.plan] ?? 0)) return { ok: false, error: "plan_limit" };
      rows = await query("update qr_codes set status='paused', updated_at=now() where workspace_id=$1 and id = any($2::uuid[]) and status='archived' returning id", p);
      break;
    }
    case "move":
      if (!(await ownedBy("folders", folderId, ws.id))) return { ok: false, error: "bad_folder" };
      rows = await query("update qr_codes set folder_id=$3, updated_at=now() where workspace_id=$1 and id = any($2::uuid[]) returning id", [ws.id, clean, folderId]);
      break;
  }
  return { ok: true, changed: rows.length };
}

/* ---------- folders & locations ---------- */

export type FolderRecord = { id: string; name: string; count: number };

export async function listFolders(workspaceId: string): Promise<FolderRecord[]> {
  return query<FolderRecord>(
    `select f.id, f.name, count(q.id)::int as count
       from folders f left join qr_codes q on q.folder_id = f.id and q.status <> 'archived'
      where f.workspace_id = $1 group by f.id, f.name order by lower(f.name)`,
    [workspaceId],
  );
}

export async function createFolder(workspaceId: string, name: string): Promise<{ ok: true; id: string } | { ok: false; error: "exists" }> {
  try {
    const [r] = await query<{ id: string }>("insert into folders (workspace_id, name) values ($1, $2) returning id", [workspaceId, name]);
    return { ok: true, id: r.id };
  } catch (e) {
    if (isUnique(e)) return { ok: false, error: "exists" };
    throw e;
  }
}

export async function listLocations(workspaceId: string): Promise<{ id: string; name: string }[]> {
  return query("select id, name from locations where workspace_id = $1 order by is_primary desc, created_at", [workspaceId]);
}

/** Used by the redirect service. */
export async function findByShortCode(code: string) {
  const [r] = await query<{
    id: string;
    workspace_id: string;
    type: string;
    config: Record<string, string>;
    status: StoredStatus;
    starts_at: Date | null;
    ends_at: Date | null;
  }>("select id, workspace_id, type, config, status, starts_at, ends_at from qr_codes where short_code = $1 and dynamic", [code]);
  return r ?? null;
}

