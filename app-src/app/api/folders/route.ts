import { NextResponse } from "next/server";
import { currentWorkspace } from "@/lib/auth/current";
import { createFolder } from "@/lib/qr-repo";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ws = await currentWorkspace();
  if (!ws) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
