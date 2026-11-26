/**
 * What an uploaded file really is, judged from its first bytes. The browser's file type and the file name are
 * never trusted. Pure TypeScript with no imports, so scripts/check-files.mjs can run it directly.
 *
 * Only PNG, JPEG, WebP and PDF are accepted. SVG is refused on purpose: it can carry scripts.
 */

export type FileMime = "image/png" | "image/jpeg" | "image/webp" | "application/pdf";
export type Sniffed = { mime: FileMime; ext: "png" | "jpg" | "webp" | "pdf"; width: number | null; height: number | null };

const at = (b: Uint8Array, i: number) => (i < b.length ? b[i] : 0);
const ascii = (b: Uint8Array, i: number, s: string) => [...s].every((c, k) => at(b, i + k) === c.charCodeAt(0));
const u16be = (b: Uint8Array, i: number) => (at(b, i) << 8) | at(b, i + 1);
const u32be = (b: Uint8Array, i: number) => ((at(b, i) << 24) | (at(b, i + 1) << 16) | (at(b, i + 2) << 8) | at(b, i + 3)) >>> 0;
const u24le = (b: Uint8Array, i: number) => at(b, i) | (at(b, i + 1) << 8) | (at(b, i + 2) << 16);

function png(b: Uint8Array): Sniffed | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 33 || !sig.every((v, i) => b[i] === v) || !ascii(b, 12, "IHDR")) return null;
  const width = u32be(b, 16), height = u32be(b, 20);
  if (!width || !height) return null;
  return { mime: "image/png", ext: "png", width, height };
}

function jpeg(b: Uint8Array): Sniffed | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return null;
  let i = 2;
  while (i + 4 < b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue; }
    if (m === 0xd9 || m === 0xda) return null; // image data reached without a frame header
    const len = u16be(b, i + 2);
    if (len < 2) return null;
    // start-of-frame markers carry the size (C4, C8 and CC are not frames)
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      const height = u16be(b, i + 5), width = u16be(b, i + 7);
      return width && height ? { mime: "image/jpeg", ext: "jpg", width, height } : null;
    }
    i += 2 + len;
  }
  return null;
}

function webp(b: Uint8Array): Sniffed | null {
  if (b.length < 30 || !ascii(b, 0, "RIFF") || !ascii(b, 8, "WEBP")) return null;
  let width = 0, height = 0;
  if (ascii(b, 12, "VP8 ")) {
    if (at(b, 23) !== 0x9d || at(b, 24) !== 0x01 || at(b, 25) !== 0x2a) return null;
    width = (at(b, 26) | (at(b, 27) << 8)) & 0x3fff;
    height = (at(b, 28) | (at(b, 29) << 8)) & 0x3fff;
  } else if (ascii(b, 12, "VP8L")) {
    if (at(b, 20) !== 0x2f) return null;
    width = 1 + (at(b, 21) | ((at(b, 22) & 0x3f) << 8));
    height = 1 + ((at(b, 22) >> 6) | (at(b, 23) << 2) | ((at(b, 24) & 0x0f) << 10));
  } else if (ascii(b, 12, "VP8X")) {
    width = 1 + u24le(b, 24);
    height = 1 + u24le(b, 27);
  } else return null;
  return width && height ? { mime: "image/webp", ext: "webp", width, height } : null;
}

function pdf(b: Uint8Array): Sniffed | null {
  return b.length >= 8 && ascii(b, 0, "%PDF-") ? { mime: "application/pdf", ext: "pdf", width: null, height: null } : null;
}

export function sniff(bytes: Uint8Array): Sniffed | null {
  return png(bytes) ?? jpeg(bytes) ?? webp(bytes) ?? pdf(bytes);
}

/* ---------- what each kind of upload accepts ---------- */

export type PurposeKey = "logo" | "document" | "image";
export type Purpose = { key: PurposeKey; label: string; maxBytes: number; mimes: FileMime[]; minSide?: number; maxSide?: number };

const IMAGES: FileMime[] = ["image/png", "image/jpeg", "image/webp"];
// The proxy clones request bodies up to 10 MB, so keep every limit below that with room for the multipart envelope.
export const PURPOSES: Record<PurposeKey, Purpose> = {
  logo: { key: "logo", label: "Logo", maxBytes: 1 * 1024 * 1024, mimes: IMAGES, minSide: 64, maxSide: 4096 },
  document: { key: "document", label: "PDF", maxBytes: 8 * 1024 * 1024, mimes: ["application/pdf"] },
  image: { key: "image", label: "Image", maxBytes: 5 * 1024 * 1024, mimes: IMAGES, maxSide: 8000 },
};
export const isPurpose = (v: unknown): v is PurposeKey => typeof v === "string" && Object.prototype.hasOwnProperty.call(PURPOSES, v);

const kind = (m: FileMime) => (m === "application/pdf" ? "a PDF" : "a PNG, JPG or WebP image");
export const accepts = (p: Purpose) => (p.mimes.length === 1 ? "a PDF" : "a PNG, JPG or WebP image");

export type Checked = { ok: true; found: Sniffed } | { ok: false; error: "empty" | "too_large" | "wrong_type" | "too_small" | "too_big_image"; message: string };

/** Checks the bytes against what the purpose accepts. */
export function check(purpose: Purpose, bytes: Uint8Array): Checked {
  if (bytes.length === 0) return { ok: false, error: "empty", message: "That file is empty." };
  const mb = purpose.maxBytes / (1024 * 1024);
  if (bytes.length > purpose.maxBytes) return { ok: false, error: "too_large", message: `That file is too large. The limit is ${mb} MB.` };
  const found = sniff(bytes);
  if (!found || !purpose.mimes.includes(found.mime)) {
    return { ok: false, error: "wrong_type", message: `Upload ${accepts(purpose)}${found ? ` (this looks like ${kind(found.mime)})` : ""}. SVG and other formats aren't accepted.` };
  }
  if (found.width && found.height) {
    if (purpose.minSide && Math.min(found.width, found.height) < purpose.minSide) {
      return { ok: false, error: "too_small", message: `That image is too small. Use one at least ${purpose.minSide} pixels on each side.` };
    }
    if (purpose.maxSide && Math.max(found.width, found.height) > purpose.maxSide) {
      return { ok: false, error: "too_big_image", message: `That image is too large. Keep each side under ${purpose.maxSide} pixels.` };
    }
  }
  return { ok: true, found };
}

/** A safe file name to show and download under: no paths, no odd characters, with the right extension. */
export function safeName(raw: string, ext: string): string {
  const base = raw.replace(/\.[A-Za-z0-9]{1,5}$/, "").replace(/[^\p{L}\p{M}\p{N}._ -]+/gu, "").replace(/\s+/g, " ").trim().replace(/^\.+/, "").slice(0, 60);
  return `${base || "file"}.${ext}`;
}
