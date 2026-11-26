import "server-only";
import { amzDateNow, authorization, sha256Hex } from "@/lib/s3-sign";

/**
 * A small S3-compatible client (PUT / GET / DELETE of whole objects), signed with Signature V4 and using plain fetch,
 * so there is no SDK to install. Works with AWS S3, Cloudflare R2, MinIO and Supabase Storage.
 *
 *   S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY   required to switch it on
 *   S3_REGION                                            default "auto" for R2 and "us-east-1" otherwise
 *   S3_ENDPOINT                                          leave empty for AWS; set for R2, MinIO, Supabase...
 *   S3_PATH_STYLE=0                                      put the bucket in the host name instead of the path (custom endpoints only)
 */

export type S3Config = { bucket: string; accessKeyId: string; secretAccessKey: string; region: string; endpoint: string; pathStyle: boolean };

export function s3Config(): S3Config | null {
  const e = process.env;
  if (!e.S3_BUCKET || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY) return null;
  const endpoint = (e.S3_ENDPOINT ?? "").replace(/\/+$/, "");
  return {
    bucket: e.S3_BUCKET,
    accessKeyId: e.S3_ACCESS_KEY_ID,
    secretAccessKey: e.S3_SECRET_ACCESS_KEY,
    region: e.S3_REGION || (endpoint ? "auto" : "us-east-1"),
    endpoint,
    // a custom endpoint (R2, MinIO, Supabase) takes the bucket in the path unless S3_PATH_STYLE=0
    pathStyle: !!endpoint && e.S3_PATH_STYLE !== "0",
  };
}

function objectUrl(c: S3Config, key: string): URL {
  const path = key.split("/").map(encodeURIComponent).join("/");
  if (c.endpoint) {
    const base = new URL(c.endpoint);
    return c.pathStyle ? new URL(`${base.origin}/${encodeURIComponent(c.bucket)}/${path}`) : new URL(`${base.protocol}//${c.bucket}.${base.host}/${path}`);
  }
  return new URL(`https://${c.bucket}.s3.${c.region}.amazonaws.com/${path}`);
}

async function call(c: S3Config, method: "PUT" | "GET" | "DELETE", key: string, body?: Uint8Array, contentType?: string): Promise<Response> {
  const url = objectUrl(c, key);
  const amzDate = amzDateNow();
  const headers: Record<string, string> = { host: url.host, "x-amz-content-sha256": sha256Hex(body ?? ""), "x-amz-date": amzDate };
  if (contentType) headers["content-type"] = contentType;
  const auth = authorization({ method, url, headers, accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey, region: c.region, amzDate });
  const { host: _host, ...send } = headers;
  void _host;
  return fetch(url, { method, headers: { ...send, authorization: auth }, body: body ? (body as unknown as BodyInit) : undefined, cache: "no-store", signal: AbortSignal.timeout(30_000) });
}

export async function s3Put(c: S3Config, key: string, body: Uint8Array, contentType: string): Promise<void> {
  const r = await call(c, "PUT", key, body, contentType);
  if (!r.ok) throw new Error(`S3 PUT failed: ${r.status} ${(await r.text().catch(() => "")).slice(0, 200)}`);
}
export async function s3Get(c: S3Config, key: string): Promise<Uint8Array | null> {
  const r = await call(c, "GET", key);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`S3 GET failed: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}
export async function s3Delete(c: S3Config, key: string): Promise<void> {
  const r = await call(c, "DELETE", key);
  if (!r.ok && r.status !== 404) throw new Error(`S3 DELETE failed: ${r.status}`);
}
