// File storage, pure logic (no server): what a file really is, what each upload kind accepts, and the S3 request
// signing against AWS's own published examples.   npm run check:storage
import { sniff, check, safeName, PURPOSES } from "../lib/file-sniff.ts";
import { authorization, sha256Hex } from "../lib/s3-sign.ts";
import { makePng, makeJpegHeader, makeWebpLossy, makeWebpLossless, makeWebpExtended, makePdf } from "./images.mjs";

let pass = 0, fail = 0;
const t = (ok, msg, extra = "") => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", msg, ok ? "" : extra); };
const j = (x) => JSON.stringify(x);

// --- what a file is, from its bytes
const png = sniff(makePng(200, 120));
t(png?.mime === "image/png" && png.width === 200 && png.height === 120 && png.ext === "png", "sniff: PNG and its size", j(png));
const jpg = sniff(makeJpegHeader(640, 480));
t(jpg?.mime === "image/jpeg" && jpg.width === 640 && jpg.height === 480 && jpg.ext === "jpg", "sniff: JPEG and its size", j(jpg));
const wl = sniff(makeWebpLossy(300, 200)), wll = sniff(makeWebpLossless(321, 123)), wx = sniff(makeWebpExtended(1000, 500));
t(wl?.mime === "image/webp" && wl.width === 300 && wl.height === 200, "sniff: WebP (lossy) and its size", j(wl));
t(wll?.mime === "image/webp" && wll.width === 321 && wll.height === 123, "sniff: WebP (lossless) and its size", j(wll));
t(wx?.mime === "image/webp" && wx.width === 1000 && wx.height === 500, "sniff: WebP (extended) and its size", j(wx));
t(sniff(makePdf())?.mime === "application/pdf", "sniff: PDF");
t(sniff(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>')) === null, "sniff: SVG is not accepted");
t(sniff(Buffer.from("<html><script>alert(1)</script></html>")) === null, "sniff: HTML is not accepted");
t(sniff(Buffer.from("GIF89a\x01\x00\x01\x00")) === null, "sniff: GIF is not accepted");
t(sniff(Buffer.from("MZ\x90\x00 an executable")) === null, "sniff: an executable is not accepted");
t(sniff(Buffer.alloc(0)) === null && sniff(Buffer.from([0x89, 0x50])) === null, "sniff: empty and truncated files are not accepted");
const pngBad = makePng(100, 100); pngBad.write("XXXX", 12, "ascii");
t(sniff(pngBad) === null, "sniff: a PNG without its header chunk is not accepted");
const evil = Buffer.concat([makePdf().subarray(0, 0), Buffer.from("<script>alert(1)</script>%PDF-1.4")]);
t(sniff(evil) === null, "sniff: a PDF signature that is not at the start is not accepted");

// --- what each purpose accepts
const L = PURPOSES.logo, D = PURPOSES.document, I = PURPOSES.image;
t(check(L, makePng(128, 128)).ok, "logo: a normal PNG is fine");
t(!check(L, makePng(32, 32)).ok && check(L, makePng(32, 32)).error === "too_small", "logo: under 64px is too small");
t(!check(L, makePng(5000, 100)).ok && check(L, makePng(5000, 100)).error === "too_big_image", "logo: over 4096px is refused");
t(check(L, makePdf()).error === "wrong_type", "logo: a PDF is the wrong type");
t(check(D, makePng(128, 128)).error === "wrong_type", "document: an image is the wrong type");
t(check(D, makePdf(1024)).ok, "document: a PDF is fine");
t(check(D, makePdf(PURPOSES.document.maxBytes)).error === "too_large", "document: over the size limit is refused");
t(check(L, Buffer.concat([makePng(128, 128), Buffer.alloc(L.maxBytes)])).error === "too_large", "logo: over 1 MB is refused");
t(check(I, Buffer.alloc(0)).error === "empty", "an empty file is refused");
t(check(I, makePng(8000, 8000)).ok && check(I, makePng(8001, 10)).error === "too_big_image", "image: dimensions are capped at 8000px");
t(Object.values(PURPOSES).every((p) => p.maxBytes < 9 * 1024 * 1024), "every limit sits under the proxy's 10 MB body limit");

// --- safe names
t(safeName("../../etc/passwd", "png") === "passwd.png" || !safeName("../../etc/passwd", "png").includes("/"), "name: no path survives", safeName("../../etc/passwd", "png"));
t(safeName("Menu <script>.pdf", "pdf") === "Menu script.pdf", "name: odd characters removed", safeName("Menu <script>.pdf", "pdf"));
t(safeName("", "pdf") === "file.pdf" && safeName("...", "png") === "file.png", "name: an empty name becomes file.<ext>");
t(safeName("logo.exe", "png") === "logo.png", "name: the extension always matches the real type");
t(safeName("தமிழ் மெனு.pdf", "pdf") === "தமிழ் மெனு.pdf", "name: Tamil letters are kept", safeName("தமிழ் மெனு.pdf", "pdf"));
t(safeName("x".repeat(300), "pdf").length <= 64, "name: long names are cut");

// --- S3 request signing: the examples in AWS's Signature V4 documentation
const base = { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", region: "us-east-1", amzDate: "20130524T000000Z" };
const sig = (a) => a.split("Signature=")[1];
t(sig(authorization({ ...base, method: "GET", url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"), headers: { host: "examplebucket.s3.amazonaws.com", range: "bytes=0-9", "x-amz-content-sha256": sha256Hex(""), "x-amz-date": "20130524T000000Z" } })) === "f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41", "sigv4: AWS example, GET object with a Range header");
t(sig(authorization({ ...base, method: "PUT", url: new URL("https://examplebucket.s3.amazonaws.com/test$file.text"), headers: { date: "Fri, 24 May 2013 00:00:00 GMT", host: "examplebucket.s3.amazonaws.com", "x-amz-content-sha256": sha256Hex("Welcome to Amazon S3."), "x-amz-date": "20130524T000000Z", "x-amz-storage-class": "REDUCED_REDUNDANCY" } })) === "98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd", "sigv4: AWS example, PUT object with a body and a $ in the key");
t(sig(authorization({ ...base, method: "GET", url: new URL("https://examplebucket.s3.amazonaws.com/?prefix=J&max-keys=2"), headers: { host: "examplebucket.s3.amazonaws.com", "x-amz-content-sha256": sha256Hex(""), "x-amz-date": "20130524T000000Z" } })) === "34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7", "sigv4: AWS example, list objects with a query string");
const a1 = authorization({ ...base, method: "GET", url: new URL("https://b.example.com/k"), headers: { host: "b.example.com", "x-amz-content-sha256": sha256Hex(""), "x-amz-date": base.amzDate } });
const a2 = authorization({ ...base, secretAccessKey: base.secretAccessKey + "x", method: "GET", url: new URL("https://b.example.com/k"), headers: { host: "b.example.com", "x-amz-content-sha256": sha256Hex(""), "x-amz-date": base.amzDate } });
t(a1 !== a2, "sigv4: a different secret gives a different signature");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
