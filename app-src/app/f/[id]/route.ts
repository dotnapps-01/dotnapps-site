import { readFile, isFileId } from "@/lib/files";

export const dynamic = "force-dynamic";

/**
 * Public address of an uploaded file: /f/<id>. The id is an unguessable UUID, so anyone with the link can open it
 * (that is how a QR code reaches a PDF). Served with the type found in the bytes, never sniffed or run by the browser.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const notFound = () => new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  if (!isFileId(id)) return notFound();
  let f;
  try {
    f = await readFile(id);
  } catch (e) {
    console.error("[files] read failed:", e instanceof Error ? e.message : e);
    return new Response("Storage is unavailable", { status: 503, headers: { "cache-control": "no-store", "retry-after": "5" } });
  }
  if (!f) return notFound();

  const etag = `"${f.meta.sha256.slice(0, 32)}"`;
  const common: Record<string, string> = {
    etag,
    "cache-control": "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
    "cross-origin-resource-policy": "cross-origin",
    "referrer-policy": "no-referrer",
  };
  // images get a locked-down policy; it is left off PDFs because it stops Chrome's built-in PDF viewer
  if (f.meta.mime !== "application/pdf") common["content-security-policy"] = "default-src 'none'; sandbox";
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: common });
  const dl = new URL(req.url).searchParams.get("download") === "1";
  const name = f.meta.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(f.bytes as unknown as BodyInit, {
    headers: {
      ...common,
      "content-type": f.meta.mime,
      "content-length": String(f.bytes.length),
      "content-disposition": `${dl ? "attachment" : "inline"}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(f.meta.name)}`,
    },
  });
}
