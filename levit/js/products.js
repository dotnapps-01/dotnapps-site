/* LEVIT catalogue. Prices are in INR. `photo` is the real photograph
 * used on cards, the quick view and the hero. */

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
    id: 'black-bell-sleeve-kurta', name: 'Bell-Sleeve Kurta Set', cat: 'kurtas', price: 2199, was: null, tag: null,
    kind: 'kurta', colors: [C.noir, C.mocha, C.navy], bg: '#E4D3BF',
    photo: 'img/p/black-bell-sleeve-kurta.webp', real: true,
    blurb: 'A relaxed black kurta with wide bell sleeves lined in blue gingham, worn with matching gingham trousers.',
    details: ['Soft cotton crepe', 'Gingham-lined bell sleeves', 'Straight, relaxed fit', 'Trousers included'],
  },
  {
    id: 'red-check-shirt', name: 'Red Check Shirt', cat: 'tops', price: 1499, was: null, tag: 'New',
    kind: 'blouse', colors: [C.wine, C.rust, C.charcoal], bg: '#F1DFE3',
    photo: 'img/p/red-check-shirt.webp', real: true,
    blurb: 'An oversized crinkle-weave check shirt with faux-leather trim on the placket and pocket.',
    details: ['Crinkle cotton blend', 'Faux-leather trim', 'Oversized fit', 'Chest pocket'],
  },
  {
    id: 'polka-tie-blouse', name: 'Polka Tie Blouse', cat: 'tops', price: 1599, was: null, tag: null,
    kind: 'blouse', colors: [C.cream, C.mocha, C.sage], bg: '#F1D2B6',
    photo: 'img/p/polka-tie-blouse.webp', real: true,
    blurb: 'A soft polka-dot blouse with a collar that ties, gathered puff sleeves and a layer of white lace.',
    details: ['Light georgette', 'Tie-neck collar', 'Puff sleeves, elastic cuffs', 'Lace underlayer'],
  },
  {
    id: 'polka-lace-set', name: 'Polka Lace Layer Set', cat: 'tops', price: 2599, was: null, tag: 'New',
    kind: 'blouse', colors: [C.cream, C.mocha], bg: '#EADFCD',
    photo: 'img/p/polka-lace-set.webp', real: true,
    blurb: 'A polka peplum top with a tiered hem and lace trim, finished with a cropped lace waistcoat.',
    details: ['Georgette with lace trim', 'Tiered peplum hem', 'Cropped lace vest included', 'Pearl button'],
  },
  {
    id: 'ruby-ruffle-dress', name: 'Ruby Ruffle Dress', cat: 'dresses', price: 3199, was: null, tag: 'Bestseller',
    kind: 'dress', colors: [C.wine, C.noir], bg: '#F6E8E4',
    photo: 'img/p/ruby-ruffle-dress.webp', real: true,
    blurb: 'A fitted mesh maxi with hand-rolled rosettes at the neckline and a cascading ruffle down the front.',
    details: ['Stretch mesh, lined', 'Rosette neckline', 'Side ruffle', 'Maxi length'],
  },
  {
    id: 'web-print-tee', name: 'Web Print Oversized Tee', cat: 'tops', price: 999, was: null, tag: null,
    kind: 'tee', colors: [C.ivory], bg: '#C6D5DD',
    photo: 'img/p/web-print-tee.webp', real: true,
    blurb: 'A heavyweight oversized tee with a bold red web graphic across the chest and sleeves.',
    details: ['220 gsm cotton', 'Oversized fit', 'Dropped shoulders', 'Screen print'],
  },
  {
    id: 'smocked-bow-top', name: 'Smocked Bow Top', cat: 'tops', price: 1599, was: null, tag: 'New',
    kind: 'blouse', colors: [C.camel, C.sage, C.blush], bg: '#F0E0A8',
    photo: 'img/p/smocked-bow-top.webp', real: true,
    blurb: 'A smocked bodice, a bow you tie at the front and gently gathered sleeves with ruffle cuffs.',
    details: ['Soft poplin', 'Smocked bodice', 'Front tie bow', 'Ruffle cuffs'],
  },
  {
    id: 'tissue-dupatta-kurta', name: 'White Kurta with Tissue Dupatta', cat: 'kurtas', price: 2899, was: null, tag: null,
    kind: 'kurta', colors: [C.ivory, C.cream], bg: '#FFFDF9',
    photo: 'img/p/tissue-dupatta-kurta.webp', real: true,
    blurb: 'A fitted white rib-knit top over a tiered cotton kurta, with a gold tissue dupatta to drape.',
    details: ['Cotton with rib-knit bodice', 'Tiered skirt', 'Tissue dupatta included', 'Ankle length'],
  },
  {
    id: 'gingham-pinafore-top', name: 'Gingham Pinafore Top', cat: 'tops', price: 1299, was: null, tag: null,
    kind: 'blouse', colors: [C.blush, C.sage], bg: '#F6E8E4',
    photo: 'img/p/gingham-pinafore-top.webp', real: true,
    blurb: 'A gingham pinafore-style peplum top with lace-edged straps, made to layer over a fitted tee.',
    details: ['Yarn-dyed gingham cotton', 'Lace-edged straps', 'Peplum hem', 'Back zip'],
  },
  {
    id: 'lace-crochet-top', name: 'Lace Crochet Top', cat: 'tops', price: 2299, was: null, tag: 'New',
    kind: 'blouse', colors: [C.denim, C.ivory], bg: '#C6D5DD',
    photo: 'img/p/lace-crochet-top.webp', real: true,
    blurb: 'Pale-blue cutwork lace with puff shoulders, bell cuffs and a side tie at the waist.',
    details: ['Cutwork cotton lace', 'Puff shoulders', 'Bell cuffs', 'Side tie'],
  },
  {
    id: 'embroidered-flare-set', name: 'Embroidered Flare Set', cat: 'dresses', price: 3499, was: null, tag: null,
    kind: 'dress', colors: [C.ivory, C.cream], bg: '#FFFDF9',
    photo: 'img/p/embroidered-flare-set.webp', real: true,
    blurb: 'A smocked puff-sleeve top with a full, embroidered flared skirt and a light drape for the shoulder.',
    details: ['Cotton-viscose', 'Smocked waist', 'Motif embroidery', 'Drape included'],
  },
  {
    id: 'grey-colourblock-shirt', name: 'Grey Colour-Block Shirt', cat: 'tops', price: 1699, was: null, tag: null,
    kind: 'blouse', colors: [C.charcoal, C.navy], bg: '#D9D0E8',
    photo: 'img/p/grey-colourblock-shirt.webp', real: true,
    blurb: 'A crisp white shirt built with a corduroy yoke panel in grey and a ruffled hem.',
    details: ['Cotton poplin with corduroy', 'Wooden buttons', 'Ruffle hem', 'Cropped, relaxed fit'],
  },
  {
    id: 'mocha-colourblock-shirt', name: 'Mocha Colour-Block Shirt', cat: 'tops', price: 1699, was: null, tag: null,
    kind: 'blouse', colors: [C.mocha, C.camel], bg: '#F1D2B6',
    photo: 'img/p/mocha-colourblock-shirt.webp', real: true,
    blurb: 'The same crisp shirt with a mocha corduroy panel and a ruffled hem, softer for AW26.',
    details: ['Cotton poplin with corduroy', 'Wooden buttons', 'Ruffle hem', 'Cropped, relaxed fit'],
  },
  {
    id: 'lime-gingham-top', name: 'Lime Gingham Top', cat: 'tops', price: 1299, was: null, tag: null,
    kind: 'blouse', colors: [C.sage, C.cream], bg: '#C5CFAE',
    photo: 'img/p/lime-gingham-top.webp', real: true,
    blurb: 'A seersucker gingham top with a smocked back, lace-edged straps and a flared hem.',
    details: ['Seersucker cotton', 'Lace-edged straps', 'Smocked back', 'Flared hem'],
  },
  {
    id: 'red-polka-midi', name: 'Red Polka Corset Midi', cat: 'dresses', price: 2599, was: null, tag: 'New',
    kind: 'midi', colors: [C.wine, C.rust], bg: '#F1DFE3',
    photo: 'img/p/red-polka-midi.webp', real: true,
    blurb: 'A red polka midi with a corset-ruched bodice, tie straps and a gathered skirt with a side slit.',
    details: ['Soft crepe', 'Corset-ruched bodice', 'Tie straps', 'Side slit'],
  },
  {
    id: 'striped-crop-shirt', name: 'Striped Crop Shirt', cat: 'tops', price: 1399, was: null, tag: null,
    kind: 'blouse', colors: [C.ivory, C.sage], bg: '#C6D5DD',
    photo: 'img/p/striped-crop-shirt.webp', real: true,
    blurb: 'A cropped pinstripe shirt with generous balloon sleeves and deep cuffs.',
    details: ['Cotton pinstripe', 'Balloon sleeves', 'Cropped length', 'Relaxed fit'],
  },
  {
    id: 'sky-crop-shirt', name: 'Sky Crop Shirt', cat: 'tops', price: 1499, was: null, tag: null,
    kind: 'blouse', colors: [C.ivory, C.denim], bg: '#C6D5DD',
    photo: 'img/p/sky-crop-shirt.webp', real: true,
    blurb: 'An asymmetric cropped shirt with chest pockets and drop shoulders in soft sky-blue poplin.',
    details: ['Cotton poplin', 'Chest pockets', 'Asymmetric hem', 'Drop shoulders'],
  },
  {
    id: 'ruby-cape-dress', name: 'Ruby Cape-Sleeve Dress', cat: 'dresses', price: 3399, was: null, tag: null,
    kind: 'dress', colors: [C.wine, C.noir], bg: '#F6E8E4',
    photo: 'img/p/ruby-cape-dress.webp', real: true,
    blurb: 'A fitted mesh dress with rosette neckline and long cape sleeves that fall to the floor.',
    details: ['Stretch mesh, lined', 'Rosette neckline', 'Cape sleeves', 'Maxi length'],
  },
  {
    id: 'navy-zip-jacket', name: 'Navy Zip Jacket', cat: 'outerwear', price: 3299, was: null, tag: 'New',
    kind: 'shacket', colors: [C.navy, C.noir], bg: '#D9D0E8',
    photo: 'img/p/navy-zip-jacket.webp', real: true,
    blurb: 'A light cropped jacket with a double-zip stand collar, gathered sleeves and flap pockets.',
    details: ['Water-resistant cotton twill', 'Double zip collar', 'Flap pockets', 'Elastic cuffs'],
  },
];

/* the catalogue is photographed pieces only: drop categories with nothing in them */
PRODUCTS.forEach((p) => { p.real = true; });
for (let i = CATEGORIES.length - 1; i >= 0; i--) if (!PRODUCTS.some((p) => p.cat === CATEGORIES[i].id)) CATEGORIES.splice(i, 1);

export const inr = (n) => '₹' + n.toLocaleString('en-IN');
export const byId = (id) => PRODUCTS.find((p) => p.id === id);
