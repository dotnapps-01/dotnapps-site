// A tiny S3-compatible server for the tests (path-style). It checks every request's Signature V4 the way S3 does,
// so a passing run means the app's signing is accepted. Not for any real use.
import { createServer } from "node:http";
import { authorization, sha256Hex } from "../lib/s3-sign.ts";

export const MOCK = { bucket: "skanor-test", accessKeyId: "AKIATESTTESTTESTTEST", secretAccessKey: "test/secret/key/for/the/mock/s3/server00" };

export function startMockS3(port) {
  const objects = new Map(); // key -> { body, type }
  const log = { bad: 0, puts: 0, gets: 0, deletes: 0 };
  let failPuts = false;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    // test controls (no signature)
    if (url.pathname === "/__objects") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ keys: [...objects.keys()], log })); }
    if (url.pathname === "/__fail") { failPuts = url.searchParams.get("on") === "1"; return res.end("ok"); }
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const deny = (code, msg) => { log.bad++; res.statusCode = code; res.end(`<Error><Code>${msg}</Code></Error>`); };

    const auth = req.headers.authorization ?? "";
    const m = /^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/([^/]+)\/s3\/aws4_request,SignedHeaders=([^,]+),Signature=([0-9a-f]{64})$/.exec(auth);
    if (!m) return deny(403, "MissingSecurityHeader");
    const [, key, , region, signed, signature] = m;
    if (key !== MOCK.accessKeyId) return deny(403, "InvalidAccessKeyId");
    const amzDate = String(req.headers["x-amz-date"] ?? "");
    if (!/^\d{8}T\d{6}Z$/.test(amzDate) || Math.abs(Date.now() - Date.parse(amzDate.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z"))) > 5 * 60_000) return deny(403, "RequestTimeTooSkewed");
    if (req.headers["x-amz-content-sha256"] !== sha256Hex(body)) return deny(400, "XAmzContentSHA256Mismatch");
    const headers = Object.fromEntries(signed.split(";").map((h) => [h, String(req.headers[h] ?? "")]));
    const expected = authorization({ method: req.method, url, headers, accessKeyId: key, secretAccessKey: MOCK.secretAccessKey, region, amzDate }).split("Signature=")[1];
    if (expected !== signature) return deny(403, "SignatureDoesNotMatch");

    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (parts[0] !== MOCK.bucket || parts.length < 2) return deny(404, "NoSuchBucket");
    const k = parts.slice(1).join("/");
    if (req.method === "PUT") {
      if (failPuts) { res.statusCode = 500; return res.end("<Error><Code>InternalError</Code></Error>"); }
      log.puts++; objects.set(k, { body, type: String(req.headers["content-type"] ?? "") }); res.statusCode = 200; return res.end();
    }
    if (req.method === "GET") {
      log.gets++;
      const o = objects.get(k);
      if (!o) { res.statusCode = 404; return res.end("<Error><Code>NoSuchKey</Code></Error>"); }
      res.setHeader("content-type", o.type); return res.end(o.body);
    }
    if (req.method === "DELETE") { log.deletes++; objects.delete(k); res.statusCode = 204; return res.end(); }
    return deny(405, "MethodNotAllowed");
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok({ close: () => server.close(), port })));
}

// run on its own:  node scripts/mock-s3.mjs 9100
if (import.meta.url === `file://${process.argv[1]}`) { const p = Number(process.argv[2] ?? 9100); await startMockS3(p); console.log(`mock S3 on :${p}, bucket ${MOCK.bucket}`); }
