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

function dress(front) {
  const sx = 0.30, sw = 0.105;                          // strap outer x, strap width
  const half = [
    [0, front ? -0.33 : -0.24],
    [0.19, front ? -0.29 : -0.24],
    [sx - sw, -SLOPE * (sx - sw)],
    [sx, -SLOPE * sx],
    [sx + 0.012, -0.27],
    [0.42, -0.36],
    [0.47, -0.58],
    [0.43, -0.92],
    [0.50, -1.30],
    [0.47, -1.78],
    [0, -1.78],
  ];
  return mirrorOutline(half, ['neck', 'neck', 'hang', 'open', 'open', 'seam', 'seam', 'seam', 'seam', 'open']);
}

function trousers() {
  const half = [
    [0, -0.05],
    [0.32, -0.05],
    [0.46, -1.80],
    [0.12, -1.80],
    [0.035, -0.86],
    [0, -0.84],
  ];
  return mirrorOutline(half, ['hang', 'seam', 'open', 'seam', 'seam']);
}

const thickDefault = (y) => 0.052 + 0.03 * Math.min(1, Math.max(0, (-0.15 - y) / 0.35));

export const PATTERNS = {
  knit: {
    outline: (front) => top({ neckDepth: 0.40, neckBack: 0.11, neckHalf: 0.17, shoulder: 0.56, sleeveL: 1.02, ang: 0.33, cuffW: 0.27, armpit: 0.40, side: 0.52, taper: 0.02, hemY: 0.95, hemTag: 'hemg' }, front),
    hangY: armLine, h: 0.032, iterations: 8, thick: (x, y) => thickDefault(y), shrink: { gather: 0.52, hemg: 0.86 },
  },
  shacket: {
    outline: (front) => top({ neckDepth: 0.22, neckBack: 0.08, neckHalf: 0.16, shoulder: 0.60, sleeveL: 1.04, ang: 0.20, cuffW: 0.31, armpit: 0.46, side: 0.60, taper: 0.0, hemY: 1.14, hemTag: 'open' }, front),
    hangY: armLine, h: 0.055, iterations: 4, thick: (x, y) => thickDefault(y) + 0.012, shrink: { gather: 0.75 },
  },
  dress: {
    outline: dress, hangY: armLine, h: 0.045, iterations: 5, thick: (x, y) => 0.05 + 0.03 * Math.min(1, Math.max(0, (-0.3 - y) / 0.4)), shrink: {}, bend: 0.2,
  },
  trouser: {
    outline: () => trousers(), hangY: barLine, h: 0.055, iterations: 4, thick: (x, y) => 0.06, shrink: {}, bend: 0.2,
  },
};
