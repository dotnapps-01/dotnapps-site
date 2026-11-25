import QRCode from "qrcode";

export type QRVariant = "square" | "dot" | "halftone";
export type QREcc = "L" | "M" | "Q" | "H";

export type QRGeometry = {
  /** modules per side of the QR symbol (no quiet zone) */
  size: number;
  /** total viewBox side, including the quiet zone */
  box: number;
  /** path of the dark data modules */
  dark: string;
  /** path of faint "off" modules (halftone only) */
  faint: string;
  /** finder patterns drawn as rounded shapes (dot / halftone) */
  finders: { x: number; y: number }[];
  roundFinders: boolean;
};

const QUIET_MODULES = 4; // QR spec quiet zone

const f = (n: number) => Number(n.toFixed(3));

/** deterministic pseudo-random in [0,1) so halftone art is stable between renders */
function hash(r: number, c: number) {
  const x = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const rect = (x: number, y: number) => `M${x} ${y}h1v1h-1z`;
const circle = (cx: number, cy: number, r: number) =>
  `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0z`;

/**
 * Build SVG geometry from the real QR matrix produced by the `qrcode` package.
 * The symbol is always encoded for real; variants only change how modules are
 * drawn (finder patterns stay solid so phones lock on).
 */
export function buildQr(value: string, variant: QRVariant, quiet: boolean, ecc?: QREcc): QRGeometry {
  const level: QREcc = ecc ?? (variant === "square" ? "M" : "Q");
  const qr = QRCode.create(value, { errorCorrectionLevel: level });
  const n = qr.modules.size;
  const q = quiet ? QUIET_MODULES : 0;
  const inFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

  let dark = "";
  let faint = "";
  const round = variant !== "square";

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (round && inFinder(r, c)) continue;
      const on = qr.modules.get(r, c) === 1;
      const x = c + q;
      const y = r + q;
      if (variant === "square") {
        if (on) dark += rect(x, y);
      } else if (variant === "dot") {
        if (on) dark += circle(x + 0.5, y + 0.5, 0.46);
      } else {
        // halftone: dots swell and shrink across the symbol, but never below
        // the size a phone can still resolve (checked with scripts/check-qr.mjs); light dots mark "off" modules.
        if (on) {
          const fade = 1 - ((r + c) / (2 * n)) * 0.12;
          const s = Math.min(1, (0.8 + hash(r, c) * 0.2) * fade);
          dark += circle(x + 0.5, y + 0.5, s * 0.48);
        } else {
          faint += circle(x + 0.5, y + 0.5, 0.09);
        }
      }
    }
  }

  const finders = round
    ? [
        { x: q, y: q },
        { x: q + n - 7, y: q },
        { x: q, y: q + n - 7 },
      ]
    : [];

  return { size: n, box: n + q * 2, dark, faint, finders, roundFinders: round };
}
