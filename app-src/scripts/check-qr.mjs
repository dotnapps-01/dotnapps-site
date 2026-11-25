// Verifies the QR codes on /styleguide really decode to the URLs they claim.
// Gate: ZXing (the engine behind most phone scanners) at camera-like resolution.
// jsQR is reported for information only; it is stricter about large, clean renders.
// Usage: npm run build && npx next start -p 3100   then   node scripts/check-qr.mjs [baseUrl]
// Needs playwright resolvable (NODE_PATH=$(npm root -g) when it is installed globally).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const jsQR = require("jsqr");
const Z = require("@zxing/library");

const base = process.argv[2] ?? "http://localhost:3100";
const expected = ["https://skn.to/demo-square", "https://skn.to/demo-dot", "https://skn.to/demo-halftone"];
const pixelsPerModule = [4, 6, 8, 12];

function zxing(d, w) {
  const lum = new Uint8ClampedArray(w * w);
  for (let i = 0; i < w * w; i++) lum[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0;
  try {
    const bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(lum, w, w)));
    const hints = new Map([[Z.DecodeHintType.TRY_HARDER, true]]);
    return new Z.QRCodeReader().decode(bmp, hints).getText();
  } catch {
    return null;
  }
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${base}/styleguide`);
const svgs = await page.$$eval('svg[role="img"][viewBox]', (els) =>
  els.map((e) => ({ html: e.outerHTML, box: Number(e.getAttribute("viewBox").split(" ")[2]) })),
);
if (svgs.length < expected.length) throw new Error(`expected ${expected.length} QR svgs, found ${svgs.length}`);

let failed = 0;
for (let i = 0; i < expected.length; i++) {
  const row = [];
  for (const mp of pixelsPerModule) {
    const px = svgs[i].box * mp;
    const img = await page.evaluate(
      async ({ svg, px }) => {
        const im = new Image();
        im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
        await im.decode();
        const c = document.createElement("canvas");
        c.width = c.height = px;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, px, px);
        ctx.drawImage(im, 0, 0, px, px);
        return { w: px, d: Array.from(ctx.getImageData(0, 0, px, px).data) };
      },
      { svg: svgs[i].html, px },
    );
    const zOk = zxing(img.d, img.w) === expected[i];
    const jOk = jsQR(new Uint8ClampedArray(img.d), img.w, img.w)?.data === expected[i];
    if (!zOk) failed++;
    row.push(`${mp}px/mod: zxing ${zOk ? "ok" : "FAIL"}, jsQR ${jOk ? "ok" : "no"}`);
  }
  console.log(`${expected[i]}\n   ${row.join("\n   ")}`);
}
await browser.close();
console.log(failed ? `\n${failed} ZXing decode failure(s)` : "\nAll QR styles decode with ZXing");
process.exit(failed ? 1 : 0);
