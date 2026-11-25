/** HMAC-signed tokens (WebCrypto, works in Node and Edge). Used for session and OTP cookies. */

const enc = new TextEncoder();
const dec = new TextDecoder();

let warned = false;
function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set (16+ characters) in production.");
  }
  if (!warned) {
    warned = true;
    console.warn("[auth] AUTH_SECRET is not set; using an insecure development secret.");
  }
  return "dev-only-insecure-secret-do-not-use";
}

function b64u(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64u(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey() {
  return crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** Sign an arbitrary JSON payload. Include `exp` (ms epoch) to make it expire. */
export async function signToken(payload: object): Promise<string> {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(body));
  return `${body}.${b64u(sig)}`;
}

/** Returns the payload if the signature is valid and it has not expired, else null. */
export async function verifyToken<T extends { exp?: number }>(token: string | undefined | null): Promise<T | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(), unb64u(sig), enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(unb64u(body))) as T;
    if (typeof payload.exp === "number" && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** HMAC of a string, hex encoded (used to bind an OTP code to its challenge). */
export async function hmacHex(data: string): Promise<string> {
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(data)));
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function randomHex(bytes = 16): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Uniformly random numeric code of the given length. */
export function randomCode(length = 6): string {
  let out = "";
  while (out.length < length) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0];
    if (n >= 4294967290) continue; // avoid modulo bias
    out += String(n % 10);
  }
  return out;
}
