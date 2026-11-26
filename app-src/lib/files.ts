import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import { PURPOSES, check, safeName, type PurposeKey } from "@/lib/file-sniff";
import { STORAGE_MB } from "@/lib/plans";
import { s3Config, s3Delete, s3Get, s3Put } from "@/lib/s3";
import type { Workspace } from "@/lib/workspace";

/**
 * Uploaded files (logos, PDFs, images). The bytes live in S3-compatible storage when S3_BUCKET is configured and in
 * Postgres otherwise; each row remembers where its bytes went, so switching later leaves older files readable.
 * Everything here is scoped to a workspace. Public files are served at /f/<id> and the id is an unguessable UUID.
 */

export type FileRecord = { id: string; purpose: string; name: string; mime: string; size: number; width: number | null; height: number | null; createdAt: string; inUse: boolean; url: string };
export type FileMeta = { id: string; workspaceId: string; purpose: string; name: string; mime: string; size: number; sha256: string };

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isFileId = (v: unknown): v is string => typeof v === "string" && uuidRe.test(v);

/** Where the bytes of new uploads go. */
export const storageDriver = (): "s3" | "db" => (s3Config() ? "s3" : "db");
export const quotaBytes = (ws: Workspace) => STORAGE_MB[ws.plan] * 1024 * 1024;

export async function storageUsed(workspaceId: string): Promise<number> {
  const [r] = await query<{ n: number }>("select coalesce(sum(size), 0)::bigint as n from files where workspace_id = $1", [workspaceId]);
  return Number(r.n);
}

/** Absolute address of a file, for pasting into a QR code or a page. APP_URL wins; else the host of this request. */
export function fileUrl(id: string, origin: string): string {
  const base = (process.env.APP_URL ?? origin).replace(/\/+$/, "");
  return `${base}/f/${id}`;
}

/** The public address of this app as the request saw it (behind a proxy the forwarded headers win). */
export function requestOrigin(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(req.url).host;
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

type Row = { id: string; purpose: string; name: string; mime: string; size: number; width: number | null; height: number | null; created_at: Date; used: boolean };

export async function listFiles(workspaceId: string, origin: string): Promise<FileRecord[]> {
  const rows = await query<Row>(
    `select f.id, f.purpose, f.name, f.mime, f.size, f.width, f.height, f.created_at,
            (exists (select 1 from workspaces w where w.id = f.workspace_id and w.logo_file_id = f.id)
             or exists (select 1 from qr_codes q where q.workspace_id = f.workspace_id and position(f.id::text in q.config::text) > 0)
             or exists (select 1 from pages p where p.workspace_id = f.workspace_id and position(f.id::text in p.content::text) > 0)
             or exists (select 1 from re_projects r where r.workspace_id = f.workspace_id and position(f.id::text in r.brochure_url) > 0)
             or exists (select 1 from products x where x.workspace_id = f.workspace_id and position(f.id::text in x.manual_url) > 0)) as used
       from files f where f.workspace_id = $1 order by f.created_at desc limit 200`,
    [workspaceId],
  );
  return rows.map((r) => ({ id: r.id, purpose: r.purpose, name: r.name, mime: r.mime, size: r.size, width: r.width, height: r.height, createdAt: r.created_at.toISOString(), inUse: r.used, url: fileUrl(r.id, origin) }));
}

export type PutResult =
  | { ok: true; file: { id: string; name: string; mime: string; size: number; width: number | null; height: number | null }; reused: boolean }
  | { ok: false; error: "empty" | "too_large" | "wrong_type" | "too_small" | "too_big_image" | "quota"; message: string };

export async function putFile(ws: Workspace, purposeKey: PurposeKey, rawName: string, bytes: Uint8Array): Promise<PutResult> {
  const purpose = PURPOSES[purposeKey];
  const c = check(purpose, bytes);
  if (!c.ok) return c;
  const { found } = c;
  const sha = createHash("sha256").update(bytes).digest("hex");
  const meta = (r: { id: string; name: string; mime: string; size: number; width: number | null; height: number | null }) => ({ id: r.id, name: r.name, mime: r.mime, size: r.size, width: r.width, height: r.height });

  // the same file uploaded again is the same file, and costs no extra space
  const [same] = await query<{ id: string; name: string; mime: string; size: number; width: number | null; height: number | null }>(
    "select id, name, mime, size, width, height from files where workspace_id = $1 and purpose = $2 and sha256 = $3",
    [ws.id, purposeKey, sha],
  );
  if (same) {
    if (purposeKey === "logo") await setLogo(ws.id, same.id);
    return { ok: true, file: meta(same), reused: true };
  }

  const used = await storageUsed(ws.id);
  // a new logo replaces the old one, so the old one's space is free for the new one
  const [old] = purposeKey === "logo" ? await query<{ size: number }>("select f.size from workspaces w join files f on f.id = w.logo_file_id where w.id = $1", [ws.id]) : [];
  if (used - (old?.size ?? 0) + bytes.length > quotaBytes(ws)) {
    return { ok: false, error: "quota", message: `Your plan includes ${STORAGE_MB[ws.plan]} MB of file storage and this would go over it. Delete files you no longer use in Settings, or upgrade.` };
  }

  const id = randomUUID();
  const name = safeName(rawName, found.ext);
  const s3 = s3Config();
  const key = `workspaces/${ws.id}/${id}.${found.ext}`;
  if (s3) await s3Put(s3, key, bytes, found.mime);
  try {
    const buf = Buffer.from(bytes);
    const rows = await query<{ id: string }>(
      `insert into files (id, workspace_id, purpose, name, mime, size, sha256, width, height, storage, skey, data)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict (workspace_id, purpose, sha256) do nothing returning id`,
      [id, ws.id, purposeKey, name, found.mime, bytes.length, sha, found.width, found.height, s3 ? "s3" : "db", s3 ? key : null, s3 ? null : buf],
    );
    if (rows.length === 0) {
      // lost a race with an identical upload: keep theirs
      if (s3) await s3Delete(s3, key).catch(() => {});
      const [r] = await query<{ id: string; name: string; mime: string; size: number; width: number | null; height: number | null }>("select id, name, mime, size, width, height from files where workspace_id = $1 and purpose = $2 and sha256 = $3", [ws.id, purposeKey, sha]);
      if (purposeKey === "logo") await setLogo(ws.id, r.id);
      return { ok: true, file: meta(r), reused: true };
    }
  } catch (e) {
    if (s3) await s3Delete(s3, key).catch(() => {});
    throw e;
  }
  if (purposeKey === "logo") await setLogo(ws.id, id);
  return { ok: true, file: { id, name, mime: found.mime, size: bytes.length, width: found.width, height: found.height }, reused: false };
}

/** Makes a file the workspace logo and removes the one it replaces. */
async function setLogo(workspaceId: string, fileId: string): Promise<void> {
  const [prev] = await query<{ logo_file_id: string | null }>("select logo_file_id from workspaces where id = $1", [workspaceId]);
  await query("update workspaces set logo_file_id = $2 where id = $1", [workspaceId, fileId]);
  if (prev?.logo_file_id && prev.logo_file_id !== fileId) await deleteFile(workspaceId, prev.logo_file_id);
}

/** Reads a file for serving. Null when it is gone or its bytes can't be found. */
export async function readFile(id: string): Promise<{ meta: FileMeta; bytes: Uint8Array } | null> {
  if (!isFileId(id)) return null;
  const [r] = await query<{ id: string; workspace_id: string; purpose: string; name: string; mime: string; size: number; sha256: string; storage: string; skey: string | null; data: Uint8Array | null }>(
    "select id, workspace_id, purpose, name, mime, size, sha256, storage, skey, data from files where id = $1",
    [id],
  );
  if (!r) return null;
  const meta: FileMeta = { id: r.id, workspaceId: r.workspace_id, purpose: r.purpose, name: r.name, mime: r.mime, size: r.size, sha256: r.sha256 };
  if (r.storage === "db") return r.data ? { meta, bytes: new Uint8Array(r.data) } : null;
  const s3 = s3Config();
  if (!s3 || !r.skey) return null;
  const bytes = await s3Get(s3, r.skey);
  return bytes ? { meta, bytes } : null;
}

/** Deletes a file (and its bytes). If it was the logo, the workspace simply has no logo afterwards. */
export async function deleteFile(workspaceId: string, id: string): Promise<boolean> {
  if (!isFileId(id)) return false;
  const rows = await query<{ storage: string; skey: string | null }>("delete from files where id = $1 and workspace_id = $2 returning storage, skey", [id, workspaceId]);
  const r = rows[0];
  if (!r) return false;
  await dropBytes(r);
  return true;
}

async function dropBytes(r: { storage: string; skey: string | null }): Promise<void> {
  const s3 = s3Config();
  if (r.storage === "s3" && r.skey && s3) await s3Delete(s3, r.skey).catch((e) => console.error("[files] could not delete object:", e instanceof Error ? e.message : e));
}

/** Removes every object a workspace has in S3. Run before deleting the workspace, whose rows go with it. */
export async function deleteWorkspaceFiles(workspaceId: string): Promise<void> {
  const rows = await query<{ storage: string; skey: string | null }>("select storage, skey from files where workspace_id = $1 and storage = 's3'", [workspaceId]);
  for (const r of rows) await dropBytes(r);
}

/** Deletes files that nothing uses (not the logo, not linked from a QR code or page). Returns how many. */
export async function deleteUnused(workspaceId: string, origin: string): Promise<number> {
  const all = await listFiles(workspaceId, origin);
  let n = 0;
  for (const f of all) if (!f.inUse && (await deleteFile(workspaceId, f.id))) n++;
  return n;
}

