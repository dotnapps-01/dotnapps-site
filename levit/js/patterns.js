/* Sewing patterns for the hero rack. Units match the scene (1 unit ≈ 0.5 m); the origin is the hanger apex,
 * y points up, so garments hang into negative y. Edge tags are documented in cloth.js. */
import { mirrorOutline } from './cloth.js';

const SLOPE = 0.27;                                  // slope of the hanger arms
export const armLine = (x) => -SLOPE * Math.abs(x) + 0.006;
export const barLine = () => -0.05;

/** boxy / fitted top with set-in sleeves, as a right half → full outline */
function top(p, front) {
  const shy = (x) => -SLOPE * x;
  const a = p.ang;
  const tip = [p.shoulder, shy(p.shoulder)];
  const outer = [tip[0] + Math.sin(a) * p.sleeveL, tip[1] - Math.cos(a) * p.sleeveL];
  const cuff = [outer[0] - Math.cos(a) * p.cuffW, outer[1] - Math.sin(a) * p.cuffW];
  const nd = front ? p.neckDepth : p.neckBack;
  const half = [
    [0, -nd],
    [p.neckHalf, shy(p.neckHalf)],
    tip, outer, cuff,
    [p.side, -p.armpit],
    [p.side - p.taper, -p.hemY],
    [0, -p.hemY],
  ];
  return mirrorOutline(half, ['neck', 'hang', 'seam', 'gather', 'seam', 'seam', p.hemTag]);
}

function jeansOutline() {
  const half = [
    [0, -0.05],
    [0.315, -0.05],
    [0.40, -1.00],
    [0.37, -1.72],
    [0.095, -1.72],
    [0.036, -0.80],
    [0, -0.77],
  ];
  return mirrorOutline(half, ['hang', 'seam', 'seam', 'open', 'seam', 'seam']);
}

const thickDefault = (y) => 0.052 + 0.03 * Math.min(1, Math.max(0, (-0.15 - y) / 0.35));

export const PATTERNS = {
  knit: {
    outline: (front) => top({ neckDepth: 0.40, neckBack: 0.11, neckHalf: 0.17, shoulder: 0.56, sleeveL: 1.02, ang: 0.33, cuffW: 0.27, armpit: 0.40, side: 0.52, taper: 0.02, hemY: 0.95, hemTag: 'hemg' }, front),
    hangY: armLine, h: 0.032, iterations: 6, thick: (x, y) => thickDefault(y), shrink: { gather: 0.52, hemg: 0.86 },
  },
  hoodie: {
    outline: (front) => top({ neckDepth: 0.13, neckBack: 0.09, neckHalf: 0.16, shoulder: 0.62, sleeveL: 1.12, ang: 0.30, cuffW: 0.30, armpit: 0.44, side: 0.60, taper: 0.0, hemY: 1.10, hemTag: 'hemg' }, front),
    hangY: armLine, h: 0.042, iterations: 5, thick: (x, y) => thickDefault(y) + 0.016, shrink: { gather: 0.6, hemg: 0.92 },
  },
  puffer: {
    outline: (front) => top({ neckDepth: 0.07, neckBack: 0.05, neckHalf: 0.17, shoulder: 0.60, sleeveL: 1.0, ang: 0.26, cuffW: 0.31, armpit: 0.42, side: 0.58, taper: 0.0, hemY: 0.84, hemTag: 'hemg' }, front),
    hangY: armLine, h: 0.045, iterations: 6, thick: (x, y) => 0.1 + 0.025 * Math.min(1, Math.max(0, (-0.2 - y) / 0.3)), shrink: { gather: 0.62, hemg: 0.9 }, bend: 0.3,
    puff: { period: 0.2, amp: 0.05, y0: -0.1 },
  },
  jeans: {
    outline: () => jeansOutline(), hangY: barLine, h: 0.05, iterations: 5, thick: () => 0.05, shrink: {}, bend: 0.25,
  },
};
