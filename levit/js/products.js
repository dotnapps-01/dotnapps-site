/* LEVIT catalogue. Prices are in INR. `kind` picks the hanger illustration; `photo`
 * (optional) is real photography that crossfades in on hover and leads the quick view. */

export const CATEGORIES = [
  { id: 'knitwear', name: 'Knitwear', blurb: 'Waffle, rib and soft merino-feel knits.' },
  { id: 'dresses', name: 'Dresses', blurb: 'Ruched, polka and after-dark silhouettes.' },
  { id: 'tops', name: 'Tops', blurb: 'Puff sleeves, button plackets, easy tees.' },
  { id: 'bottoms', name: 'Bottoms', blurb: 'Wide-leg, denim and pleated skirts.' },
  { id: 'outerwear', name: 'Outerwear', blurb: 'Puffers, shackets and heavy layers.' },
  { id: 'kurtas', name: 'Kurtas', blurb: 'Block-print cotton, cut for everyday.' },
];

export const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

const C = {
  rust: { name: 'Rust', hex: '#a8531e' },
  mocha: { name: 'Mocha', hex: '#5b3a29' },
  sand: { name: 'Sand', hex: '#cdb494' },
  noir: { name: 'Noir', hex: '#14100d' },
  ivory: { name: 'Ivory', hex: '#eadfcd' },
  wine: { name: 'Wine', hex: '#6f2230' },
  sage: { name: 'Sage', hex: '#7c8160' },
  charcoal: { name: 'Charcoal', hex: '#4f4844' },
  camel: { name: 'Camel', hex: '#b07b5d' },
  navy: { name: 'Navy', hex: '#2e3b55' },
  taupe2: { name: 'Taupe', hex: '#6e4a36' },
  khaki: { name: 'Khaki', hex: '#807a55' },
  olive: { name: 'Olive', hex: '#6b6a3c' },
  denim: { name: 'Indigo', hex: '#3d5166' },
  taupe: { name: 'Taupe', hex: '#9b8672' },
  blush: { name: 'Blush', hex: '#d6a496' },
  cream: { name: 'Cream', hex: '#f1e6d3' },
  black: { name: 'Black', hex: '#1b1613' },
};

export const PRODUCTS = [
  {
    id: 'black-oxford-shirt', name: 'Black Oxford Shirt', cat: 'tops', price: 1499, was: null, tag: 'New',
    kind: 'blouse', colors: [C.black, C.cream, C.denim], bg: '#E4E7EF',
    blurb: 'A sharp, relaxed shirt in soft Oxford cotton with a folded collar and sewn buttons. Wear it tucked, loose or open over a tee.',
    details: ['Oxford cotton', 'Relaxed fit', 'Folded collar', 'Curved hem'],
  },
  {
    id: 'burgundy-tunic', name: 'Burgundy Tunic', cat: 'kurtas', price: 1699, was: null, tag: null,
    kind: 'kurta', colors: [C.wine, C.mocha, C.sage], bg: '#F1DFE3',
    blurb: 'A clean, straight tunic with long sleeves and turned cuffs. Easy over denim or trousers.',
    details: ['Woven cotton blend', 'Straight fit', 'Turned cuffs', 'Hip length'],
  },
  {
    id: 'navy-floral-dress', name: 'Navy Floral Dress', cat: 'dresses', price: 2499, was: 2999, tag: '-17%',
    kind: 'midi', pat: 'lv-floral', colors: [C.navy, C.wine], bg: '#E0E6F0',
    blurb: 'A banded-waist midi in a small-scale floral on navy, with long sleeves and a skirt that moves.',
    details: ['Printed viscose crepe', 'Banded waist', 'Long sleeves', 'Midi length'],
  },
  {
    id: 'blush-floral-shirt', name: 'Blush Floral Shirt', cat: 'tops', price: 1399, was: null, tag: null,
    kind: 'blouse', pat: 'lv-floral', colors: [C.blush, C.sage], bg: '#F6E8E4',
    blurb: 'A soft, loose shirt in a blush floral print with a folded collar and a covered placket.',
    details: ['Printed cotton voile', 'Loose fit', 'Folded collar', 'Sewn buttons'],
  },
  {
    id: 'wrap-collar-midi-dress', name: 'Wrap Midi Dress', cat: 'dresses', price: 2899, was: null, tag: 'New',
    kind: 'midi', colors: [C.camel, C.sage, C.wine, C.navy], bg: '#F4EAE1',
    photo: 'img/dress-camel-card.webp',
    blurb: 'A collared wrap dress with puff sleeves, a banded waist with covered buttons and a pleated A-line skirt. Soft crepe that holds its shape and moves when you do.',
    details: ['Soft stretch crepe', 'Collared wrap bodice', 'Puff sleeves with cuffs', 'Pleated midi skirt'],
  },
  {
    id: 'brushed-fleece-hoodie', name: 'Brushed Fleece Hoodie', cat: 'tops', price: 2199, was: null, tag: 'New',
    kind: 'hoodie', colors: [C.charcoal, C.sand, C.ivory], bg: '#C6D5DD',
    blurb: 'Oversized, heavyweight and brushed soft inside. Dropped shoulders, ribbed cuffs, a deep kangaroo pocket and a hood that holds its shape.',
    details: ['450 gsm brushed cotton fleece', 'Oversized fit', 'Ribbed cuffs and hem', 'Flat drawcords'],
  },
  {
    id: 'cropped-puffer-jacket', name: 'Cropped Puffer Jacket', cat: 'outerwear', price: 3999, was: 4799, tag: '-17%',
    kind: 'puffer', colors: [C.khaki, C.noir, C.blush], bg: '#D9D0E8',
    blurb: 'A cropped, quilted puffer with a high collar, zipped pockets and a ripstop shell. Light on the shoulders, warm where it counts.',
    details: ['Recycled ripstop shell', 'Lightweight recycled fill', 'Zipped hand pockets', 'Elasticated cuffs and hem'],
  },
  {
    id: 'rust-waffle-wrap-knit', name: 'Waffle Wrap Knit', cat: 'knitwear', price: 1799, was: 2299, tag: 'New',
    kind: 'knit', colors: [C.rust, C.mocha, C.sand], bg: '#C5CFAE',
    photo: 'img/knit-rust.webp', hero: true,
    blurb: 'A cropped, blouson-sleeve knit in a deep waffle stitch with a V-neck that sits over a satin slip. Elasticated hem and cuffs hold the shape.',
    details: ['Waffle-knit viscose blend', 'Cropped, relaxed fit', 'Elasticated hem & cuffs', 'Satin slip sold separately'],
  },
  {
    id: 'noir-shimmer-ruched-dress', name: 'Noir Shimmer Dress', cat: 'dresses', price: 2499, was: null, tag: 'Bestseller',
    kind: 'dress', pat: 'lv-sparkle', colors: [C.noir, C.wine], bg: '#D9D0E8',
    photo: 'img/model-noir.webp',
    blurb: 'Side-ruched midi in a stretch mesh scattered with micro-sparkle. Worn here over our ivory ribbed turtleneck.',
    details: ['Stretch sparkle mesh, lined', 'Side-ruched, bodycon fit', 'Sweetheart neckline', 'Hidden back zip'],
  },
  {
    id: 'ivory-ribbed-turtleneck', name: 'Ribbed Turtleneck', cat: 'knitwear', price: 1299, was: null, tag: null,
    kind: 'turtle', colors: [C.sand, C.ivory, C.black], bg: '#C6D5DD',
    blurb: 'The layering piece. Close-fit rib with a soft, folded collar that stays put.',
    details: ['Stretch rib knit', 'Close fit', 'Folded high neck', 'Machine washable'],
  },
  {
    id: 'polka-midi-dress', name: 'Polka Midi Dress', cat: 'dresses', price: 2199, was: 2799, tag: '-21%',
    kind: 'midi', pat: 'lv-dots', colors: [C.noir, C.wine], bg: '#EBC7BB',
    blurb: 'Long sleeves, a nipped waist and a gently flared skirt, in a crisp polka crepe.',
    details: ['Polka crepe', 'Belted waist', 'Long sleeves', 'Midi length'],
  },
  {
    id: 'satin-slip-dress', name: 'Satin Slip Dress', cat: 'dresses', price: 2799, was: null, tag: 'New',
    kind: 'dress', colors: [C.wine, C.noir, C.blush], bg: '#F0E0A8',
    blurb: 'Bias-cut satin that moves with you. Adjustable straps, side slit.',
    details: ['Heavy satin', 'Bias cut', 'Adjustable straps', 'Side slit'],
  },
  {
    id: 'puff-sleeve-blouse', name: 'Puff-Sleeve Blouse', cat: 'tops', price: 1399, was: null, tag: null,
    kind: 'blouse', colors: [C.sage, C.cream, C.blush], bg: '#F1D2B6',
    blurb: 'Gathered puff sleeves and a covered placket, in a breathable cotton voile.',
    details: ['Cotton voile', 'Puff sleeves', 'Covered placket', 'Relaxed fit'],
  },
  {
    id: 'button-blouse', name: 'Placket Blouse', cat: 'tops', price: 1199, was: null, tag: null,
    kind: 'blouse', colors: [C.cream, C.mocha], bg: '#D9A585',
    blurb: 'A softly structured everyday blouse with pearl-effect buttons.',
    details: ['Cotton poplin', 'Pearl-effect buttons', 'Regular fit', 'Machine washable'],
  },
  {
    id: 'boxy-shacket', name: 'Boxy Shacket', cat: 'outerwear', price: 2999, was: 3499, tag: '-14%',
    kind: 'shacket', colors: [C.olive, C.mocha, C.sand], bg: '#EBCDBF',
    blurb: 'Heavy twill, boxy cut, two chest pockets. Wear it as a shirt, a jacket, or a layer.',
    details: ['Brushed cotton twill', 'Boxy fit', 'Two chest pockets', 'Corozo buttons'],
  },
  {
    id: 'open-cardigan', name: 'Open Cardigan', cat: 'knitwear', price: 2299, was: null, tag: null,
    kind: 'cardi', colors: [C.mocha, C.sand, C.sage], bg: '#C6D5DD',
    blurb: 'Long, open-front and impossibly soft. Rib trims, dropped shoulder.',
    details: ['Soft rib knit', 'Open front', 'Dropped shoulder', 'Longline'],
  },
  {
    id: 'wide-leg-trousers', name: 'Wide-Leg Trousers', cat: 'bottoms', price: 1899, was: null, tag: 'Bestseller',
    kind: 'trouser', colors: [C.taupe, C.noir, C.cream], bg: '#D9D0E8',
    blurb: 'High-rise, fluid and floor-skimming. Pressed crease, hidden hook closure.',
    details: ['Fluid crepe', 'High rise', 'Pressed crease', 'Side pockets'],
  },
  {
    id: 'straight-jeans', name: 'Washed Straight Jeans', cat: 'bottoms', price: 1599, was: null, tag: null,
    kind: 'jeans', colors: [C.denim, C.black], bg: '#F0E0A8',
    blurb: 'Mid-rise straight leg in a rigid, garment-washed denim.',
    details: ['100% cotton denim', 'Mid rise', 'Straight leg', 'Five pockets'],
  },
  {
    id: 'pleated-midi-skirt', name: 'Pleated Midi Skirt', cat: 'bottoms', price: 1699, was: null, tag: null,
    kind: 'skirt', colors: [C.mocha, C.sage, C.noir], bg: '#BCC7A6',
    blurb: 'Knife pleats that swing. Elasticated back waist for an easy day-to-night fit.',
    details: ['Pleated crepe', 'Elastic back waist', 'Midi length', 'Lined'],
  },
  {
    id: 'everyday-cotton-tee', name: 'Everyday Cotton Tee', cat: 'tops', price: 799, was: 999, tag: '-20%',
    kind: 'tee', colors: [C.ivory, C.noir, C.rust], bg: '#D99B7A',
    blurb: 'Heavyweight cotton jersey that drapes instead of clings.',
    details: ['220 gsm cotton jersey', 'Relaxed fit', 'Ribbed crew neck', 'Pre-shrunk'],
  },
  {
    id: 'floral-cotton-kurta', name: 'Floral Cotton Kurta', cat: 'kurtas', price: 1499, was: null, tag: 'New',
    kind: 'kurta', pat: 'lv-floral', colors: [C.mocha, C.olive, C.rust], bg: '#EFD9A0',
    blurb: 'Hand-block inspired floral on soft cotton. Straight cut with a deep V and brass-tone buttons.',
    details: ['Block-print cotton', 'Straight fit', 'Three-quarter sleeves', 'Calf length'],
  },
  {
    id: 'embroidered-kurta', name: 'Yoke Embroidered Kurta', cat: 'kurtas', price: 1899, was: null, tag: null,
    kind: 'kurta', colors: [C.ivory, C.sage, C.wine], bg: '#B9CBBF',
    blurb: 'Tone-on-tone yoke embroidery on cotton mul. Light, breathable, effortless.',
    details: ['Cotton mul', 'Yoke embroidery', 'Straight fit', 'Knee length'],
  },
];

export const inr = (n) => '₹' + n.toLocaleString('en-IN');
export const byId = (id) => PRODUCTS.find((p) => p.id === id);
