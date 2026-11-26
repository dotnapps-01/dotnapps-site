import { NextResponse } from "next/server";
import { currentWorkspace } from "@/lib/auth/current";
import { auditAs } from "@/lib/audit";
import { fileUrl, listFiles, putFile, quotaBytes, requestOrigin, storageUsed } from "@/lib/files";
import { PURPOSES, isPurpose } from "@/lib/file-sniff";
import { allow } from "@/lib/throttle";

export const dynamic = "force-dynamic";

/** The workspace's files and how much of the plan's space they use. */
export async function GET(req: Request) {
  const ws = await currentWorkspace();
  if (!ws) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [files, used] = await Promise.all([listFiles(ws.id, requestOrigin(req)), storageUsed(ws.id)]);
  return NextResponse.json({ files, used, quota: quotaBytes(ws) });
}

/** Upload: multipart form with `file` and `purpose` (logo, document or image). The type is judged from the bytes, not the name. */
export async function POST(req: Request) {
  const ws = await currentWorkspace();
  if (!ws) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ws.suspended) return NextResponse.json({ error: "suspended" }, { status: 403 });
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data")) return NextResponse.json({ error: "invalid", message: "Send the file as a form upload." }, { status: 415 });
  if (!(await allow(`ws:${ws.id}`, "file_upload", 60))) return NextResponse.json({ error: "rate_limited", message: "Too many uploads. Try again in a while." }, { status: 429 });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > 9 * 1024 * 1024) return NextResponse.json({ error: "too_large", message: "That file is too large." }, { status: 413 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid", message: "That upload could not be read." }, { status: 400 });
  }
  const purpose = form.get("purpose");
  if (!isPurpose(purpose)) return NextResponse.json({ error: "invalid", message: "Say what the file is for." }, { status: 422 });
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "invalid", message: "Choose a file to upload." }, { status: 422 });
  if (file.size > PURPOSES[purpose].maxBytes) return NextResponse.json({ error: "too_large", message: `That file is too large. The limit is ${PURPOSES[purpose].maxBytes / (1024 * 1024)} MB.` }, { status: 413 });

  let r;
  try {
    r = await putFile(ws, purpose, file.name, new Uint8Array(await file.arrayBuffer()));
  } catch (e) {
    console.error("[files] upload failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "storage_unavailable", message: "We couldn't store that file right now. Please try again in a moment." }, { status: 503 });
  }
  if (!r.ok) return NextResponse.json({ error: r.error, message: r.message }, { status: r.error === "quota" ? 413 : r.error === "too_large" ? 413 : 422 });
  if (!r.reused) await auditAs(ws.id, "file.uploaded", `${purpose}: ${r.file.name}`);
  return NextResponse.json({ ok: true, reused: r.reused, file: { ...r.file, purpose, url: fileUrl(r.file.id, requestOrigin(req)) } }, { status: r.reused ? 200 : 201 });
}
