import { createHash, createHmac } from "node:crypto";

/**
 * AWS Signature Version 4 for S3-compatible storage (AWS S3, Cloudflare R2, MinIO, Supabase Storage...).
 * Pure functions with no server-only import, so scripts/check-files.mjs can check them against AWS's published examples.
 */

export const sha256Hex = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest();

/** RFC 3986 encoding, as S3 wants it (a "/" in a path is kept by the caller). */
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const encPath = (p: string) => p.split("/").map((seg) => enc(decodeURIComponent(seg))).join("/");

export type SignInput = {
  method: string;
  url: URL;
  /** Every header given here is signed. Include host, x-amz-content-sha256 and x-amz-date. */
  headers: Record<string, string>;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service?: string;
  /** 20130524T000000Z */
  amzDate: string;
};

/** The Authorization header value for the request. */
export function authorization(i: SignInput): string {
  const service = i.service ?? "s3";
  const day = i.amzDate.slice(0, 8);
  const names = Object.keys(i.headers).map((h) => h.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(i.headers).map(([k, v]) => [k.toLowerCase(), v.trim().replace(/\s+/g, " ")]));
  const canonicalHeaders = names.map((n) => `${n}:${lower[n]}\n`).join("");
  const signedHeaders = names.join(";");
  const query = [...i.url.searchParams.entries()].map(([k, v]) => [enc(k), enc(v)]).sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join("&");
  const payloadHash = lower["x-amz-content-sha256"] ?? sha256Hex("");
  const canonical = [i.method.toUpperCase(), encPath(i.url.pathname), query, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${day}/${i.region}/${service}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", i.amzDate, scope, sha256Hex(canonical)].join("\n");
  const kDate = hmac(`AWS4${i.secretAccessKey}`, day);
  const key = hmac(hmac(hmac(kDate, i.region), service), "aws4_request");
  const signature = createHmac("sha256", key).update(toSign).digest("hex");
  return `AWS4-HMAC-SHA256 Credential=${i.accessKeyId}/${scope},SignedHeaders=${signedHeaders},Signature=${signature}`;
}

export const amzDateNow = (d = new Date()) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
