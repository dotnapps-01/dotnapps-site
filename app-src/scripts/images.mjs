// Small valid files for the tests: a real PNG (solid colour) and header-only JPEG / WebP / PDF stand-ins.
import { crc32, deflateSync } from "node:zlib";

const be32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
const chunk = (type, data) => { const t = Buffer.from(type, "ascii"); return Buffer.concat([be32(data.length), t, data, be32(crc32(Buffer.concat([t, data])))]); };

/** A valid w×h PNG filled with one colour. */
export function makePng(w = 128, h = 128, [r, g, b] = [14, 14, 16]) {
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => [r, g, b]).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  const ihdr = Buffer.concat([be32(w), be32(h), Buffer.from([8, 2, 0, 0, 0])]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** Enough of a JPEG for its size to be read (not a picture). */
export function makeJpegHeader(w, h) {
  const u16 = (n) => Buffer.from([n >> 8, n & 255]);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]), Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08]), u16(h), u16(w), Buffer.from([3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]), Buffer.from([0xff, 0xd9])]);
}

const riff = (body) => { const size = Buffer.alloc(4); size.writeUInt32LE(body.length + 4); return Buffer.concat([Buffer.from("RIFF"), size, Buffer.from("WEBP"), body]); };
const le24 = (n) => Buffer.from([n & 255, (n >> 8) & 255, (n >> 16) & 255]);
const le16 = (n) => Buffer.from([n & 255, (n >> 8) & 255]);
const chunkLe = (type, data) => { const s = Buffer.alloc(4); s.writeUInt32LE(data.length); return Buffer.concat([Buffer.from(type), s, data, data.length % 2 ? Buffer.from([0]) : Buffer.alloc(0)]); };
export const makeWebpLossy = (w, h) => riff(chunkLe("VP8 ", Buffer.concat([Buffer.from([0, 0, 0, 0x9d, 0x01, 0x2a]), le16(w), le16(h), Buffer.alloc(8)])));
export const makeWebpLossless = (w, h) => { const bits = (w - 1) | ((h - 1) << 14); const b = Buffer.alloc(4); b.writeUInt32LE(bits >>> 0); return riff(chunkLe("VP8L", Buffer.concat([Buffer.from([0x2f]), b, Buffer.alloc(8)]))); };
export const makeWebpExtended = (w, h) => riff(chunkLe("VP8X", Buffer.concat([Buffer.alloc(4), le24(w - 1), le24(h - 1)])));

export const makePdf = (pad = 0) => Buffer.concat([Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"), Buffer.alloc(pad, 0x20)]);
