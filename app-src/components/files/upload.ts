export type UploadedFile = { id: string; name: string; mime: string; size: number; width: number | null; height: number | null; purpose: string; url: string };
export type Purpose = "logo" | "document" | "image";

/** What the file picker offers for each purpose (the server checks the real bytes again). */
export const ACCEPT: Record<Purpose, string> = { logo: "image/png,image/jpeg,image/webp", document: "application/pdf", image: "image/png,image/jpeg,image/webp" };

/** Sends one file to /api/files. Returns the stored file, or a message fit to show the person. */
export async function uploadFile(file: File, purpose: Purpose): Promise<{ ok: true; file: UploadedFile } | { ok: false; message: string }> {
  const body = new FormData();
  body.set("purpose", purpose);
  body.set("file", file);
  const res = await fetch("/api/files", { method: "POST", body }).catch(() => null);
  const j = (await res?.json().catch(() => null)) ?? {};
  if (res?.ok && j.file) return { ok: true, file: j.file as UploadedFile };
  if (res?.status === 401) return { ok: false, message: "Your session has ended. Please sign in again." };
  return { ok: false, message: typeof j.message === "string" ? j.message : "We couldn't upload that file. Please try again." };
}

export const formatBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(n >= 10 * 1024 * 1024 ? 0 : 1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);
