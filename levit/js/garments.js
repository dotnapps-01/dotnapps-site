/* Flat-lay garment illustrations on a hanger — the shop-grid stand-ins for photography.
 * Each garment is drawn once and tinted per colourway, so swatches recolour live.
 * Shared <defs> (gradients + weaves) live in index.html under #lv-defs.
 */

const INK = '#0b0907';
const BRASS = '#c9a45e';

/** Darken/lighten a hex colour. amt in -1..1 */
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/* a filled panel with cylindrical shading painted over it */
const P = (d, fill, extra = '') =>
  `<path d="${d}" fill="${fill}" ${extra}/><path d="${d}" fill="url(#lv-shade)"/>`;
const mirror = (inner) => `<g transform="translate(200 0) scale(-1 1)">${inner}</g>`;
const line = (d, o = 0.22, w = 1.1, c = '#000') =>
  `<path d="${d}" fill="none" stroke="${c}" stroke-opacity="${o}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

/* hangers */
const hangerArms = () => `
  <path d="M20 70 Q58 54 100 45 Q142 54 180 70" fill="none" stroke="${INK}" stroke-width="4.6" stroke-linecap="round"/>
  <path d="M20 68.5 Q58 52.5 100 43.5" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="1" stroke-linecap="round"/>`;
const hangerBar = () => `
  <path d="M24 66 H176" stroke="${INK}" stroke-width="4.6" stroke-linecap="round"/>
  <path d="M24 64.6 H176" stroke="#fff" stroke-opacity=".16" stroke-width="1"/>`;
const hook = () => `
  <path d="M100 46 V32 C100 25 108 23 108.6 16.5 C109 9.5 101 5.5 96 8.6 C92.4 10.8 92.8 16 96.4 17" fill="none" stroke="${BRASS}" stroke-width="2.3" stroke-linecap="round"/>`;

/* sleeves (left side drawn, mirrored for right) */
const sleeveLongFn = (c, cuff, ext = 0) => {
  const d = `M61 62 Q43 65 38 88 L${26 - ext * 0.1} ${166 + ext} Q34 ${175 + ext} 47 ${171 + ext} L60 108 L63 118 Z`;
  const cf = `M${26 - ext * 0.1} ${166 + ext} Q34 ${175 + ext} 47 ${171 + ext} L48.6 ${161 + ext} L28 ${157 + ext} Z`;
  const one = `${P(d, c)}${P(cf, cuff)}${line(`M40 96 Q36 130 31 ${160 + ext}`, .16)}`;
  return one + mirror(one);
};

const sleevePuff = (c) => {
  const one = `${P('M66 62 Q38 58 30 98 Q32 118 56 114 Q60 88 72 72 Z', c)}${line('M44 76 Q40 96 48 108', .18)}${line('M36 90 Q38 104 52 110', .12)}`;
  return one + mirror(one);
};
const sleeveShort = (c) => {
  const one = `${P('M62 60 L40 70 L30 100 L50 110 L66 88 Z', c)}`;
  return one + mirror(one);
};

/* ------------------------------------------------------------ garment kinds */
const KINDS = {
  /* cropped V-neck knit, long sleeves */
  knit: ({ c, c2 }) => {
    const rib = shade(c, -0.18);
    return hangerArms() +
      sleeveLongFn(c, rib) +
      P('M80 54 L100 88 L120 54 L141 62 L143 128 Q100 139 57 128 L59 62 Z', c) +
      `<path d="M80 54 L100 88 L120 54 L141 62 L143 128 Q100 139 57 128 L59 62 Z" fill="url(#lv-waffle)" opacity=".5"/>` +
      P('M57 119 Q100 130 143 119 L143 128 Q100 139 57 128 Z', rib) +
      `<path d="M84 55 L100 83 L116 55 Z" fill="#f2eee6"/>` +
      line('M80 54 L100 88 L120 54', .45, 2.6, shade(c, -0.5)) +
      line('M70 70 Q66 100 68 116', .12) + line('M130 70 Q134 100 132 116', .12);
  },
  /* ribbed turtleneck */
  turtle: ({ c }) => {
    const rib = shade(c, -0.1);
    return hangerArms() +
      sleeveLongFn(c, rib) +
      P('M80 54 Q100 62 120 54 L141 62 L143 126 Q100 137 57 126 L59 62 Z', c) +
      `<path d="M80 54 Q100 62 120 54 L141 62 L143 126 Q100 137 57 126 L59 62 Z" fill="url(#lv-rib)" opacity=".7"/>` +
      P('M84 44 L116 44 L119 60 Q100 69 81 60 Z', rib) +
      `<path d="M84 44 L116 44 L119 60 Q100 69 81 60 Z" fill="url(#lv-rib)" opacity=".8"/>`;
  },
  /* spaghetti-strap ruched dress */
  dress: ({ c, pat }) => {
    const body = 'M73 70 Q86 64 100 74 Q114 64 127 70 L131 112 Q140 164 129 228 Q100 238 71 228 Q60 164 69 112 Z';
    let out = hangerArms();
    out += `<path d="M78 60 L82 72 M122 60 L118 72" stroke="${shade(c, -0.25)}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`;
    out += P(body, c);
    if (pat) out += `<path d="${body}" fill="url(#${pat})"/>`;
    // ruching
    for (let i = 0; i < 5; i++) {
      const y = 98 + i * 17;
      out += line(`M69.5 ${y} Q84 ${y + 9} 98 ${y - 2}`, .2, 1.1) + line(`M130.5 ${y} Q116 ${y + 9} 102 ${y - 2}`, .2, 1.1);
    }
    out += line('M73 70 Q86 64 100 74 Q114 64 127 70', .3, 1.5);
    return out;
  },
  /* midi dress, long sleeves, belt */
  midi: ({ c, pat, c2 }) => {
    const body = 'M70 60 L100 53 L130 60 L134 108 Q144 172 140 238 Q100 249 60 238 Q56 172 66 108 Z';
    let out = hangerArms() + sleeveLongFn(c, shade(c, -0.15), 6);
    out += P(body, c);
    if (pat) out += `<path d="${body}" fill="url(#${pat})"/>`;
    out += P('M92 54 L100 70 L108 54 L112 52 L100 62 L88 52 Z', c2 || '#f2eee6');
    out += P('M66 110 Q100 120 134 110 L135 118 Q100 128 65 118 Z', shade(c, -0.35));
    out += line('M100 70 V110', .2);
    return out;
  },
  /* puff-sleeve blouse */
  blouse: ({ c, c2 }) => {
    const body = 'M68 60 L100 53 L132 60 L142 150 Q100 162 58 150 Z';
    let out = hangerArms() + sleevePuff(c) + P(body, c);
    out += P('M86 54 L100 72 L95 78 L80 58 Z', shade(c, 0.08)) + P('M114 54 L100 72 L105 78 L120 58 Z', shade(c, 0.08));
    out += line('M100 72 V156', .28, 1.3);
    for (let i = 0; i < 6; i++) out += `<circle cx="100" cy="${86 + i * 12}" r="1.5" fill="${c2 || '#f6efe3'}" stroke="#000" stroke-opacity=".25" stroke-width=".5"/>`;
    out += line('M72 70 Q70 110 66 146', .1) + line('M128 70 Q130 110 134 146', .1);
    return out;
  },
  /* open cardigan over a tee */
  cardi: ({ c, c2 }) => {
    const inner = c2 || '#f2eadc';
    return hangerArms() +
      P('M86 54 L114 54 L112 206 L88 206 Z', inner) +
      sleeveLongFn(c, shade(c, -0.15), 8) +
      P('M62 62 L84 54 L90 66 L90 206 L62 202 Z', c) +
      P('M138 62 L116 54 L110 66 L110 206 L138 202 Z', c) +
      `<path d="M62 62 L84 54 L90 66 L90 206 L62 202 Z M138 62 L116 54 L110 66 L110 206 L138 202 Z" fill="url(#lv-rib)" opacity=".45"/>` +
      line('M90 66 L90 206', .35, 2.4, shade(c, -0.4)) + line('M110 66 L110 206', .35, 2.4, shade(c, -0.4)) +
      P('M62 190 L90 192 L90 206 L62 202 Z', shade(c, -0.15)) + P('M138 190 L110 192 L110 206 L138 202 Z', shade(c, -0.15));
  },
  /* boxy shacket */
  shacket: ({ c }) => {
    const body = 'M63 62 L100 53 L137 62 L141 176 H59 Z';
    return hangerArms() + sleeveLongFn(c, shade(c, -0.12), 10) + P(body, c) +
      `<path d="${body}" fill="url(#lv-twill)" opacity=".5"/>` +
      P('M82 52 L100 80 L118 52 L113 47 L100 62 L87 47 Z', shade(c, 0.06)) +
      line('M100 80 V176', .3, 1.4) +
      P('M70 104 H92 V126 L81 130 L70 126 Z', shade(c, -0.06)) + P('M108 104 H130 V126 L119 130 L108 126 Z', shade(c, -0.06)) +
      [96, 118, 140, 162].map((y) => `<circle cx="100" cy="${y}" r="1.7" fill="${shade(c, -0.55)}"/>`).join('') +
      P('M59 166 H141 V176 H59 Z', shade(c, -0.12));
  },
  /* oversized hoodie with a bunched hood and drawcords */
  hoodie: ({ c }) => {
    const rib = shade(c, -0.15);
    return hangerArms() +
      P('M70 58 Q100 14 130 58 Q100 72 70 58 Z', shade(c, -0.12)) +
      sleeveLongFn(c, rib, 14) +
      P('M72 58 Q100 72 128 58 L143 66 L144 192 Q100 200 56 192 L57 66 Z', c) +
      P('M56 182 Q100 190 144 182 L144 192 Q100 200 56 192 Z', rib) +
      P('M76 130 L124 130 L132 172 L68 172 Z', shade(c, -0.07)) +
      line('M76 130 L124 130 M76 130 L68 172 M124 130 L132 172', .3, 1.4) +
      `<path d="M92 66 V104 M108 66 V104" stroke="#ddd6ca" stroke-width="2" stroke-linecap="round" fill="none"/>` +
      P('M82 58 Q100 40 118 58 Q100 68 82 58 Z', shade(c, -0.3));
  },
  /* cropped puffer with horizontal baffles */
  puffer: ({ c }) => {
    const rib = shade(c, -0.2);
    let baffles = '';
    for (let y = 80; y < 150; y += 14) baffles += line(`M60 ${y} Q100 ${y + 5} 140 ${y}`, .3, 1.2);
    let sleeve = '';
    for (let y = 84; y < 160; y += 16) sleeve += line(`M36 ${y} Q46 ${y + 3} 58 ${y}`, .22, 1) + `<g transform="translate(200 0) scale(-1 1)">${line(`M36 ${y} Q46 ${y + 3} 58 ${y}`, .22, 1)}</g>`;
    return hangerArms() + sleeveLongFn(c, rib, 4) + sleeve +
      P('M70 56 L130 56 L142 62 L142 152 Q100 160 58 152 L58 62 Z', c) + baffles +
      P('M58 144 Q100 152 142 144 L142 152 Q100 160 58 152 Z', rib) +
      P('M80 46 Q100 40 120 46 L122 62 Q100 70 78 62 Z', shade(c, 0.06)) +
      line('M100 66 V152', .4, 1.6, '#000') + `<rect x="98.5" y="66" width="3" height="6" rx="1" fill="#cfc9bd"/>`;
  },
  /* wide-leg trousers on a bar hanger */
  trouser: ({ c, wide = 1 }) => {
    const w = 9 * wide;
    const d = `M64 66 H136 L${142 + w} 246 H${106 + w * 0.2} L100 124 L${94 - w * 0.2} 246 H${58 - w} Z`;
    return hangerBar() + P(d, c) +
      P('M64 66 H136 V77 H64 Z', shade(c, -0.14)) +
      line('M100 77 V124', .25, 1.2) + line(`M78 80 L${72 - w * 0.4} 244`, .13) + line(`M122 80 L${128 + w * 0.4} 244`, .13) +
      `<circle cx="100" cy="71.5" r="1.6" fill="${BRASS}"/>` +
      `<path d="M62 62 V74 M138 62 V74" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  },
  /* straight jeans */
  jeans: ({ c }) => {
    const d = 'M64 66 H136 L141 246 H108 L100 126 L92 246 H59 Z';
    const st = '#e6d3a8';
    return hangerBar() + P(d, c) +
      `<path d="${d}" fill="url(#lv-denim)" opacity=".55"/>` +
      P('M64 66 H136 V76 H64 Z', shade(c, -0.18)) +
      `<path d="M100 76 V126 M100 76 Q112 92 112 96" fill="none" stroke="${st}" stroke-opacity=".7" stroke-width=".9" stroke-dasharray="2 1.6"/>` +
      `<path d="M66 78 Q74 98 90 96 M134 78 Q126 98 110 96" fill="none" stroke="${st}" stroke-opacity=".7" stroke-width=".9" stroke-dasharray="2 1.6"/>` +
      line('M70 150 Q74 160 80 150', .15) + line('M130 150 Q126 160 120 150', .15) +
      `<path d="M62 62 V74 M138 62 V74" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  },
  /* pleated midi skirt */
  skirt: ({ c }) => {
    const d = 'M66 66 H134 L158 234 Q100 248 42 234 Z';
    let out = hangerBar() + P(d, c) + P('M66 66 H134 V76 H66 Z', shade(c, -0.14));
    for (let i = -6; i <= 6; i++) {
      const x0 = 100 + i * 5, x1 = 100 + i * 12.8;
      out += line(`M${x0} 78 L${x1} 238`, i % 2 ? .1 : .2, 1);
    }
    out += `<path d="M62 62 V74 M138 62 V74" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    return out;
  },
  /* everyday crew tee */
  tee: ({ c }) =>
    hangerArms() + P('M62 60 L84 54 Q100 64 116 54 L138 60 L160 94 L141 108 L134 96 L134 156 H66 V96 L59 108 L40 94 Z', c) +
    `<path d="M84 54 Q100 64 116 54" fill="none" stroke="${shade(c, -0.35)}" stroke-width="3.2" stroke-linecap="round"/>` +
    line('M66 148 H134', .18) + line('M70 70 Q66 110 68 148', .1),
  /* floral kurta */
  kurta: ({ c, pat }) => {
    const body = 'M80 54 L100 76 L120 54 L139 62 L152 98 L136 104 L138 238 H62 L64 104 L48 98 L61 62 Z';
    let out = hangerArms() + P(body, c);
    if (pat) out += `<path d="${body}" fill="url(#${pat})"/>`;
    out += P('M80 54 L100 76 L120 54 L124 56 L100 84 L76 56 Z', shade(c, -0.3));
    out += P('M62 226 H138 V238 H62 Z', shade(c, -0.3));
    out += line('M100 84 V150', .25, 1.2) + `<circle cx="100" cy="92" r="1.5" fill="${BRASS}"/><circle cx="100" cy="106" r="1.5" fill="${BRASS}"/><circle cx="100" cy="120" r="1.5" fill="${BRASS}"/>`;
    return out;
  },
};

export function garmentSVG(kind, opts = {}) {
  const fn = KINDS[kind] || KINDS.tee;
  const body = fn({ c: '#9a4b1b', ...opts });
  return `<svg class="garment" viewBox="0 0 200 260" aria-hidden="true" focusable="false"><g class="garment__swing">${body}${hook()}</g></svg>`;
}

/** Shared gradients and weaves; inject once into the page */
export const GARMENT_DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs id="lv-defs">
  <linearGradient id="lv-shade" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="#000" stop-opacity=".30"/>
    <stop offset=".22" stop-color="#000" stop-opacity=".04"/>
    <stop offset=".55" stop-color="#fff" stop-opacity=".09"/>
    <stop offset=".82" stop-color="#000" stop-opacity=".07"/>
    <stop offset="1" stop-color="#000" stop-opacity=".34"/>
  </linearGradient>
  <pattern id="lv-waffle" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="none"/><path d="M0 .6H4M.6 0V4" stroke="#000" stroke-opacity=".28" stroke-width=".9"/></pattern>
  <pattern id="lv-rib" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M1.5 0V3" stroke="#000" stroke-opacity=".22" stroke-width=".9"/></pattern>
  <pattern id="lv-twill" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 4L4 0" stroke="#000" stroke-opacity=".18" stroke-width=".7"/></pattern>
  <pattern id="lv-denim" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><path d="M0 1H3" stroke="#fff" stroke-opacity=".16" stroke-width=".6"/><path d="M1 0V3" stroke="#000" stroke-opacity=".12" stroke-width=".5"/></pattern>
  <pattern id="lv-sparkle" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".7" fill="#fff" fill-opacity=".95"/><circle cx="6.6" cy="5.4" r=".55" fill="#fff" fill-opacity=".7"/><circle cx="3.4" cy="7.8" r=".4" fill="#fff" fill-opacity=".6"/></pattern>
  <pattern id="lv-dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="1.7" fill="#f3e9da" fill-opacity=".92"/></pattern>
  <pattern id="lv-floral" width="22" height="22" patternUnits="userSpaceOnUse">
    <g fill="#f2e6d4" fill-opacity=".85"><circle cx="6" cy="6" r="1.7"/><circle cx="6" cy="2.6" r="1.3"/><circle cx="6" cy="9.4" r="1.3"/><circle cx="2.6" cy="6" r="1.3"/><circle cx="9.4" cy="6" r="1.3"/></g>
    <circle cx="6" cy="6" r="1" fill="#c9a45e"/>
    <g fill="#f2e6d4" fill-opacity=".6"><circle cx="17" cy="17" r="1.2"/><circle cx="17" cy="14.4" r=".9"/><circle cx="17" cy="19.6" r=".9"/><circle cx="14.4" cy="17" r=".9"/><circle cx="19.6" cy="17" r=".9"/></g>
    <path d="M10 14 Q12 12 13.5 13.5" stroke="#f2e6d4" stroke-opacity=".5" fill="none" stroke-width=".8"/>
  </pattern>
</defs></svg>`;
