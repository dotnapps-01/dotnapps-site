import { NextResponse } from "next/server";
import { authorize } from "@/lib/api-auth";
import { createFolder } from "@/lib/qr-repo";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const a = await authorize("build");
  if ("error" in a) return a.error;
  const ws = a.ws;
  let name = "";
  try {
    name = String((await req.json()).name ?? "").trim().slice(0, 40);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (name.length < 1) return NextResponse.json({ error: "invalid", fields: { name: "Enter a folder name." } }, { status: 422 });
  const r = await createFolder(ws.id, name);
  if (!r.ok) return NextResponse.json({ error: "exists", fields: { name: "You already have a folder with that name." } }, { status: 409 });
  return NextResponse.json({ ok: true, id: r.id }, { status: 201 });
}
