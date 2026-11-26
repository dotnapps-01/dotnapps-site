// File storage over HTTP: uploads (logo, PDF, image), what is refused, the public /f/<id> address, replacing and deleting,
// space quota, isolation between businesses, where logos show up, and cleanup when a workspace is deleted.
// Needs the DEV server:  npm run dev   then   npm run check:files [baseUrl]
// Set DATABASE_URL (same database as the server) to also check the stored rows.
// Set MOCK_S3=http://127.0.0.1:<port> when the server was started with S3_* pointing at scripts/mock-s3.mjs: the
// same checks run against S3 storage, plus a check that every request was signed correctly and that a storage outage is handled.
import { makePdf, makePng } from "./images.mjs";

const B = process.argv[2] ?? "http://localhost:3000";
const MOCK = process.env.MOCK_S3 ?? "";
let pass = 0, fail = 0, skipped = 0;
const t = (ok, msg, extra = "") => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", msg, ok ? "" : extra); };
const skip = (msg) => { skipped++; console.log("SKIP", msg); };
const rnd = () => "9" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
class Jar { c = {}; absorb(res) { for (const s of res.headers.getSetCookie()) { const [kv] = s.split(";"); const i = kv.indexOf("="); const k = kv.slice(0, i), v = kv.slice(i + 1); if (/max-age=0|expires=thu, 01 jan 1970/i.test(s) || v === "") delete this.c[k]; else this.c[k] = v; } } get h() { return Object.entries(this.c).map(([k, v]) => `${k}=${v}`).join("; "); } }
const call = async (jar, method, path, body, headers = {}) => { const r = await fetch(B + path, { method, redirect: "manual", headers: { "content-type": "application/json", cookie: jar?.h ?? "", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }); jar?.absorb(r); let j = {}; try { j = await r.clone().json(); } catch {} return { r, j }; };
const page = async (jar, path) => { const r = await fetch(B + path, { headers: { cookie: jar?.h ?? "" }, redirect: "manual" }); return { s: r.status, html: await r.text() }; };
const anon = null;
async function signUp(name) {
  const jar = new Jar();
  const x = await call(jar, "POST", "/api/auth/otp/send", { mode: "signup", phone: rnd(), businessName: name });
  await call(jar, "POST", "/api/auth/otp/verify", { code: x.j.devCode });
  await call(jar, "POST", "/api/onboarding", { industry: "food", goals: ["reviews"], locationName: "Anna Nagar, Chennai", address: "1 Main Rd", complete: true });
  return jar;
}
/** Uploads like the browser does: multipart with `file` and `purpose`. */
async function upload(jar, purpose, bytes, name, type) {
  const f = new FormData();
  if (purpose !== undefined) f.set("purpose", purpose);
  if (bytes !== undefined) f.set("file", new Blob([bytes], { type }), name);
  const r = await fetch(B + "/api/files", { method: "POST", headers: { cookie: jar?.h ?? "" }, body: f });
  let j = {}; try { j = await r.json(); } catch {}
  return { r, j };
}
const get = async (path, headers = {}) => { const r = await fetch(B + path, { headers, redirect: "manual" }); const b = Buffer.from(await r.arrayBuffer()); return { r, b }; };
const mock = async () => (MOCK ? (await (await fetch(MOCK + "/__objects")).json()) : null);

const hasDb = !!process.env.DATABASE_URL;
let db = null;
if (hasDb) { const { default: pgmod } = await import("pg"); db = new pgmod.Client({ connectionString: process.env.DATABASE_URL }); await db.connect(); }
const rows = async (sql, p = []) => (db ? (await db.query(sql, p)).rows : null);

const A = await signUp("Saravana Cafe"), Bz = await signUp("Glow Salon"), Q = await signUp("Quota Shop"), R = await signUp("Rate Limit Co");

/* ---------------- access ---------------- */
let x = await upload(anon, "logo", makePng(128, 128), "logo.png", "image/png"); t(x.r.status === 401, "upload: logged out -> 401");
x = await call(anon, "GET", "/api/files"); t(x.r.status === 401, "list: logged out -> 401");
x = await call(anon, "DELETE", "/api/files/00000000-0000-4000-8000-000000000000"); t(x.r.status === 401, "delete: logged out -> 401");
x = await call(anon, "POST", "/api/files/cleanup"); t(x.r.status === 401, "cleanup: logged out -> 401");

/* ---------------- logo ---------------- */
const png1 = makePng(128, 128, [14, 14, 16]);
x = await upload(A, "logo", png1, "My Logo.png", "image/png");
t(x.r.status === 201 && x.j.ok && x.j.file.purpose === "logo" && x.j.file.width === 128 && x.j.file.height === 128 && x.j.file.mime === "image/png" && x.j.file.name === "My Logo.png", "logo: upload -> 201 with type and size read from the bytes", JSON.stringify(x.j));
const logo1 = x.j.file;
t(new URL(logo1.url).pathname === `/f/${logo1.id}`, "logo: the file address is /f/<id>", logo1.url);
let g = await get(`/f/${logo1.id}`);
t(g.r.status === 200 && g.r.headers.get("content-type") === "image/png" && g.b.equals(png1), "serve: anyone with the link gets the exact bytes, as image/png");
t(g.r.headers.get("x-content-type-options") === "nosniff", "serve: nosniff");
t(/immutable/.test(g.r.headers.get("cache-control") ?? "") && /public/.test(g.r.headers.get("cache-control") ?? ""), "serve: cacheable for a long time");
t(/sandbox/.test(g.r.headers.get("content-security-policy") ?? ""), "serve: images carry a sandbox policy");
t(/^inline;/.test(g.r.headers.get("content-disposition") ?? ""), "serve: images open inline");
const etag = g.r.headers.get("etag");
g = await get(`/f/${logo1.id}`, { "if-none-match": etag }); t(g.r.status === 304 && g.b.length === 0, "serve: If-None-Match -> 304");
x = await page(A, "/app/settings"); t(x.s === 200 && x.html.includes(`/f/${logo1.id}`) && /Replace logo/.test(x.html), "settings: shows the logo and a Replace button");
x = await upload(A, "logo", png1, "again.png", "image/png"); t(x.r.status === 200 && x.j.reused && x.j.file.id === logo1.id, "logo: the same file again is the same file", JSON.stringify(x.j));
x = await call(A, "GET", "/api/files"); t(x.j.files.length === 1 && x.j.used === png1.length, "list: the same file again costs no extra space", JSON.stringify({ n: x.j.files.length, used: x.j.used }));

// replacing the logo removes the old one
const png2 = makePng(160, 160, [91, 69, 184]);
const objectsBefore = await mock();
x = await upload(A, "logo", png2, "new-logo.png", "image/png"); t(x.r.status === 201, "logo: a different logo uploads");
const logo2 = x.j.file;
g = await get(`/f/${logo1.id}`); t(g.r.status === 404, "logo: the old logo is gone");
g = await get(`/f/${logo2.id}`); t(g.r.status === 200 && g.b.equals(png2), "logo: the new logo is served");
x = await call(A, "GET", "/api/files"); t(x.j.files.length === 1 && x.j.files[0].id === logo2.id && x.j.used === png2.length && x.j.files[0].inUse === true, "list: one logo, in use, counted once", JSON.stringify(x.j.files));
x = await page(A, "/app/settings"); t(x.html.includes(`/f/${logo2.id}`) && !x.html.includes(`/f/${logo1.id}`), "settings: shows the new logo only");

/* ---------------- what is refused ---------------- */
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" onload="alert(1)"><rect width="200" height="200"/></svg>');
x = await upload(A, "logo", svg, "logo.svg", "image/svg+xml"); t(x.r.status === 422 && x.j.error === "wrong_type", "refused: SVG");
x = await upload(A, "logo", svg, "logo.png", "image/png"); t(x.r.status === 422 && x.j.error === "wrong_type", "refused: SVG renamed to .png with an image type");
x = await upload(A, "document", Buffer.from("<html><script>alert(1)</script></html>"), "menu.pdf", "application/pdf"); t(x.r.status === 422 && x.j.error === "wrong_type", "refused: HTML renamed to .pdf");
x = await upload(A, "logo", makePdf(), "logo.pdf", "application/pdf"); t(x.r.status === 422 && x.j.error === "wrong_type", "refused: a PDF as a logo");
x = await upload(A, "document", makePng(200, 200), "x.pdf", "application/pdf"); t(x.r.status === 422 && x.j.error === "wrong_type", "refused: a PNG as a document");
x = await upload(A, "logo", makePng(32, 32), "tiny.png", "image/png"); t(x.r.status === 422 && x.j.error === "too_small", "refused: a logo under 64px");
x = await upload(A, "logo", Buffer.alloc(0), "empty.png", "image/png"); t(x.r.status === 422, "refused: an empty file", JSON.stringify(x.j));
x = await upload(A, "logo", Buffer.concat([png2, Buffer.alloc(1.2 * 1024 * 1024)]), "huge.png", "image/png"); t(x.r.status === 413 && x.j.error === "too_large", "refused: a logo over 1 MB -> 413");
x = await upload(A, undefined, png2, "a.png", "image/png"); t(x.r.status === 422, "refused: no purpose");
x = await upload(A, "avatar", png2, "a.png", "image/png"); t(x.r.status === 422, "refused: an unknown purpose");
x = await upload(A, "logo", undefined); t(x.r.status === 422, "refused: no file");
x = await call(A, "POST", "/api/files", { purpose: "logo" }); t(x.r.status === 415, "refused: JSON instead of a form -> 415");
x = await call(A, "GET", "/api/files"); t(x.j.files.length === 1, "refused uploads leave nothing behind");

/* ---------------- documents ---------------- */
const pdf1 = makePdf(2048);
x = await upload(A, "document", pdf1, "../../Price List <v2>.pdf", "application/pdf");
t(x.r.status === 201 && x.j.file.mime === "application/pdf" && x.j.file.name === "Price List v2.pdf", "document: PDF uploads; the name is made safe", JSON.stringify(x.j.file));
const doc1 = x.j.file;
g = await get(`/f/${doc1.id}`);
t(g.r.status === 200 && g.r.headers.get("content-type") === "application/pdf" && g.b.equals(pdf1), "serve: the PDF, as application/pdf");
t(!g.r.headers.get("content-security-policy"), "serve: no sandbox policy on PDFs (it breaks Chrome's PDF viewer)");
t(/^inline; filename="Price List v2.pdf"/.test(g.r.headers.get("content-disposition") ?? ""), "serve: PDFs open inline under their name", g.r.headers.get("content-disposition"));
g = await get(`/f/${doc1.id}?download=1`); t(/^attachment;/.test(g.r.headers.get("content-disposition") ?? ""), "serve: ?download=1 saves instead of opening");
x = await upload(A, "document", makePdf(4096), "ஆங்கில மெனு.pdf", "application/pdf"); t(x.r.status === 201 && x.j.file.name === "ஆங்கில மெனு.pdf", "document: a Tamil file name is kept", x.j.file?.name);
const doc2 = x.j.file;
g = await get(`/f/${doc2.id}`); t(g.r.status === 200 && /filename\*=UTF-8''/.test(g.r.headers.get("content-disposition") ?? ""), "serve: a non-ASCII name still makes a valid header");
x = await upload(A, "image", makePng(300, 200), "photo.png", "image/png"); t(x.r.status === 201 && x.j.file.purpose === "image", "image: PNG uploads");
const img1 = x.j.file;

/* ---------------- public address ---------------- */
g = await get("/f/not-a-uuid"); t(g.r.status === 404, "serve: a bad id -> 404");
g = await get("/f/3f2b8a52-0a64-4b6f-9a77-0a1f0c0d9e11"); t(g.r.status === 404, "serve: an id that doesn't exist -> 404");
g = await get(`/f/${doc1.id.toUpperCase()}`); t([200, 404].includes(g.r.status), "serve: an upper-case id doesn't crash", String(g.r.status));

/* ---------------- list, "in use", cleanup ---------------- */
x = await call(A, "GET", "/api/files");
t(x.r.status === 200 && x.j.files.length === 4 && x.j.quota === 20 * 1024 * 1024 && x.j.used === png2.length + pdf1.length + makePdf(4096).length + makePng(300, 200).length, "list: four files, space used adds up, quota is the plan's", JSON.stringify({ n: x.j.files.length, used: x.j.used, quota: x.j.quota }));
t(x.j.files.every((f) => f.url.includes(`/f/${f.id}`)) && x.j.files.find((f) => f.id === doc1.id).inUse === false, "list: documents nothing links to are not in use");
x = await call(A, "POST", "/api/qr", { name: "Price list", type: "pdf", config: { url: doc1.url }, publish: true });
t(x.r.status === 201, "qr: a PDF QR code can point at an uploaded file", JSON.stringify(x.j));
const pdfQr = x.j;
x = await call(A, "GET", "/api/files"); t(x.j.files.find((f) => f.id === doc1.id).inUse === true && x.j.files.find((f) => f.id === doc2.id).inUse === false, "list: a file a QR code links to is now in use");
let hop = await fetch(`${B}/q/${pdfQr.shortCode}`, { redirect: "manual", headers: { "user-agent": "Mozilla/5.0 (Linux; Android 14) Mobile Safari/537.36" } });
t(hop.status >= 300 && hop.status < 400 && hop.headers.get("location") === doc1.url, "qr: scanning it redirects to the uploaded PDF", `${hop.status} ${hop.headers.get("location")}`);
x = await call(A, "POST", "/api/files/cleanup"); t(x.r.status === 200 && x.j.removed === 2, "cleanup: deletes the unused PDF and image only", JSON.stringify(x.j));
g = await get(`/f/${doc2.id}`); t(g.r.status === 404, "cleanup: the unused file is gone");
g = await get(`/f/${doc1.id}`); t(g.r.status === 200, "cleanup: the file a QR code uses stays");
g = await get(`/f/${logo2.id}`); t(g.r.status === 200, "cleanup: the logo stays");
x = await call(A, "POST", "/api/files/cleanup"); t(x.j.removed === 0, "cleanup: nothing left to remove");

/* ---------------- QR centre logo ---------------- */
x = await call(A, "POST", "/api/qr", { name: "Logo code", type: "url", dynamic: true, config: { url: "https://example.com" }, design: { color: "#0E0E10", variant: "dot", label: "SCAN ME", logo: true }, publish: true });
t(x.r.status === 201, "design: a code with the logo option saves", JSON.stringify(x.j));
const logoQr = x.j;
x = await page(A, "/app/library"); t(x.s === 200 && /logo\\?":true/.test(x.html), "design: the logo option is kept");
x = await call(A, "POST", "/api/qr", { name: "Odd logo", type: "url", dynamic: true, config: { url: "https://example.com" }, design: { color: "#0E0E10", variant: "dot", label: "SCAN ME", logo: "yes" }, publish: false });
t(x.r.status === 201, "design: a non-boolean logo value is accepted but ignored", JSON.stringify(x.j));
x = await page(A, "/app/library"); t(!/logo\\?":\\?"yes/.test(x.html) && (x.html.match(/logo\\?":true/g) ?? []).length === 1, "design: and not stored");

/* ---------------- logo on customer pages ---------------- */
{
  const C = await signUp("Logo Cafe");
  const cLogo = (await upload(C, "logo", makePng(128, 128, [200, 30, 30]), "cafe.png", "image/png")).j.file;
  const review = await call(C, "POST", "/api/qr", { name: "Table 1", type: "review", config: { googleUrl: "https://g.page/r/CabcdEFghij12345/review", source: "Table 1" }, publish: true });
  t(review.r.status === 201, "customer pages: review QR created", JSON.stringify(review.j));
  x = await page(anon, `/r/${review.j.shortCode}`); t(x.s === 200 && x.html.includes(`/f/${cLogo.id}`), "customer pages: the review page shows the business logo");
  const reviewB = await call(Bz, "POST", "/api/qr", { name: "Table 1", type: "review", config: { googleUrl: "https://g.page/r/CabcdEFghij12345/review", source: "Table 1" }, publish: true });
  x = await page(anon, `/r/${reviewB.j.shortCode}`); t(x.s === 200 && !x.html.includes("/f/"), "customer pages: a business without a logo shows initials, no broken image");
  x = await call(C, "POST", "/api/pages", { kind: "bio", title: "Links" }); const bioId = x.j.id;
  await call(C, "PATCH", `/api/pages/${bioId}`, { title: "Links", status: "published", content: { headline: "Find us", links: [{ label: "Menu", url: "https://example.com/menu" }] } });
  const bioQr = await call(C, "POST", "/api/qr", { name: "Bio", type: "bio", config: { pageId: bioId }, publish: true });
  x = await page(anon, `/s/${bioQr.j.shortCode}`); t(x.s === 200 && x.html.includes(`/f/${cLogo.id}`), "customer pages: engage pages show the business logo too", `${x.s} ${JSON.stringify(bioQr.j)}`);
  await call(C, "DELETE", `/api/files/${cLogo.id}`);
  x = await page(anon, `/r/${review.j.shortCode}`); t(x.s === 200 && !x.html.includes(`/f/${cLogo.id}`), "customer pages: deleting the logo removes it from the review page");
}

/* ---------------- isolation ---------------- */
x = await call(Bz, "DELETE", `/api/files/${doc1.id}`); t(x.r.status === 404, "isolation: another business can't delete your file");
g = await get(`/f/${doc1.id}`); t(g.r.status === 200, "isolation: …and it is still there");
x = await call(Bz, "GET", "/api/files"); t(x.j.files.length === 0 && x.j.used === 0, "isolation: another business sees none of your files");
x = await upload(Bz, "logo", png2, "same-bytes.png", "image/png"); t(x.r.status === 201 && x.j.file.id !== logo2.id, "isolation: the same bytes in another business are a separate file");
const bLogo = x.j.file;
x = await call(A, "DELETE", `/api/files/${bLogo.id}`); t(x.r.status === 404, "isolation: you can't delete theirs either");
x = await call(A, "DELETE", "/api/files/not-a-uuid"); t(x.r.status === 404, "delete: a bad id -> 404");

/* ---------------- delete ---------------- */
x = await call(A, "DELETE", `/api/files/${doc1.id}`); t(x.r.status === 200, "delete: removes the file");
g = await get(`/f/${doc1.id}`); t(g.r.status === 404, "delete: its address stops working");
x = await call(A, "DELETE", `/api/files/${doc1.id}`); t(x.r.status === 404, "delete: twice -> 404");
x = await call(A, "DELETE", `/api/files/${logo2.id}`); t(x.r.status === 200, "delete: removes the logo");
x = await page(A, "/app/settings"); t(x.html.includes("Upload logo") && !x.html.includes(`/f/${logo2.id}`), "settings: back to no logo");
x = await call(A, "GET", `/api/files`); t(x.j.files.length === 0 && x.j.used === 0, "delete: space is freed");
x = await call(A, "POST", "/api/files/cleanup"); t(x.r.status === 200 && x.j.removed === 0, "cleanup: nothing to remove on an empty list");

/* ---------------- quota ---------------- */
const big = (n) => { const b = makePdf(7.5 * 1024 * 1024); b.write(String(n).padStart(8, "0"), b.length - 8); return b; };
x = await upload(Q, "document", big(1), "a.pdf", "application/pdf"); t(x.r.status === 201, "quota: first 7.5 MB PDF fits (free plan: 20 MB)");
const qa = x.j.file;
x = await upload(Q, "document", big(2), "b.pdf", "application/pdf"); t(x.r.status === 201, "quota: second fits");
x = await upload(Q, "document", big(3), "c.pdf", "application/pdf"); t(x.r.status === 413 && x.j.error === "quota" && /20 MB/.test(x.j.message), "quota: the third would go over -> 413 with a clear message", JSON.stringify(x.j));
x = await call(Q, "GET", "/api/files"); t(x.j.files.length === 2, "quota: the refused file was not stored");
x = await upload(Q, "document", big(1), "a-again.pdf", "application/pdf"); t(x.r.status === 200 && x.j.reused, "quota: re-uploading a file you already have still works when full");
x = await call(Q, "DELETE", `/api/files/${qa.id}`); t(x.r.status === 200, "quota: delete one…");
x = await upload(Q, "document", big(3), "c.pdf", "application/pdf"); t(x.r.status === 201, "quota: …and the third now fits");
x = await page(Q, "/app/settings"); t(x.s === 200 && /File storage/.test(x.html) && /15 MB/.test(x.html), "settings: shows space used and the plan's limit", "");

/* ---------------- throttle ---------------- */
{
  let last = 0, firstBlocked = -1;
  const tiny = (i) => { const b = makePdf(0); return Buffer.concat([b, Buffer.from(` ${i}`)]); };
  for (let i = 0; i < 64; i++) { const r = await upload(R, "document", tiny(i), `n${i}.pdf`, "application/pdf"); last = r.r.status; if (last === 429 && firstBlocked < 0) firstBlocked = i; }
  t(firstBlocked === 60 && last === 429, "throttle: the 61st upload within the hour is refused", `first blocked at ${firstBlocked}, last status ${last}`);
}

/* ---------------- stored rows and workspace deletion ---------------- */
{
  const D = await signUp("Doomed Ltd");
  const f1 = (await upload(D, "logo", makePng(100, 100, [1, 2, 3]), "d.png", "image/png")).j.file;
  const f2 = (await upload(D, "document", makePdf(500), "d.pdf", "application/pdf")).j.file;
  const keysBefore = (await mock())?.keys.length;
  if (db) {
    const r = await rows("select storage, skey, (data is not null) as has_data, size from files where id = any($1::uuid[])", [[f1.id, f2.id]]);
    t(r.length === 2 && r.every((x) => (MOCK ? x.storage === "s3" && x.skey && !x.has_data : x.storage === "db" && !x.skey && x.has_data)), `rows: bytes are stored in ${MOCK ? "S3 (key set, nothing in the table)" : "the database"}`, JSON.stringify(r));
  } else skip("rows: where the bytes live (set DATABASE_URL)");
  x = await call(D, "POST", "/api/settings/delete", { confirm: "Doomed Ltd" }); t(x.r.status === 200, "delete workspace: accepted");
  g = await get(`/f/${f1.id}`); t(g.r.status === 404, "delete workspace: its logo address stops working");
  g = await get(`/f/${f2.id}`); t(g.r.status === 404, "delete workspace: its PDF address stops working");
  if (db) { const left = await rows("select count(*)::int as n from files where id = any($1::uuid[])", [[f1.id, f2.id]]); t(left[0].n === 0, "delete workspace: no file rows left behind"); } else skip("delete workspace: rows (set DATABASE_URL)");
  if (MOCK) { const m = await mock(); t(m.keys.length === keysBefore - 2, "delete workspace: its objects are removed from S3", `${keysBefore} -> ${m.keys.length}`); }
}

/* ---------------- S3 only ---------------- */
if (MOCK) {
  const before = await mock();
  const c = makePng(140, 140, [30, 60, 90]);
  x = await upload(Bz, "logo", c, "s3-logo.png", "image/png"); t(x.r.status === 201, "s3: upload accepted by a server that checks signatures");
  const sLogo = x.j.file;
  let m = await mock(); t(m.keys.length === before.keys.length, "s3: the new logo's object is stored and the one it replaced is removed", `${before.keys.length} -> ${m.keys.length}`);
  t(m.keys.some((k) => k.endsWith(`${sLogo.id}.png`) && k.startsWith("workspaces/")), "s3: stored under workspaces/<id>/<file>.png");
  g = await get(`/f/${sLogo.id}`); t(g.r.status === 200 && g.b.equals(c) && g.r.headers.get("content-type") === "image/png", "s3: the file is read back through a signed GET, byte for byte");
  // an outage during upload: clean error, nothing stored, nothing counted
  await fetch(MOCK + "/__fail?on=1");
  const usedBefore = (await call(Bz, "GET", "/api/files")).j.used;
  x = await upload(Bz, "document", makePdf(777), "outage.pdf", "application/pdf"); t(x.r.status === 503 && x.j.error === "storage_unavailable", "s3: an outage while uploading -> 503 with a plain message", JSON.stringify(x.j));
  await fetch(MOCK + "/__fail?on=0");
  x = await call(Bz, "GET", "/api/files"); t(x.j.used === usedBefore && !x.j.files.some((f) => f.name === "outage.pdf"), "s3: …and nothing was recorded");
  x = await upload(Bz, "document", makePdf(777), "outage.pdf", "application/pdf"); t(x.r.status === 201, "s3: once storage is back, the same upload works");
  const doc = x.j.file;
  const n1 = (await mock()).keys.length;
  x = await call(Bz, "DELETE", `/api/files/${doc.id}`); t(x.r.status === 200, "s3: delete accepted");
  t((await mock()).keys.length === n1 - 1, "s3: delete removes the object");
  m = await mock(); t(m.log.bad === 0, "s3: every request carried a valid signature", JSON.stringify(m.log));
} else skip("s3: set MOCK_S3 (see test:all) to run the S3 checks");

if (db) await db.end();
console.log(`\n${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ""}`);
process.exit(fail ? 1 : 0);
