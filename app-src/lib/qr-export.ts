import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRFramed, FRAME_W, frameHeight } from "@/components/qr/QRFramed";
import type { QrDesign } from "@/lib/qr-types";

/** Standalone SVG text for a framed QR (used for SVG downloads, PNG rendering and ZIPs). */
export function framedSvgString(value: string, design: QrDesign, logoHref?: string): string {
  return renderToStaticMarkup(
    createElement(QRFramed, { value, variant: design.variant, color: design.color, label: design.label, size: FRAME_W, logoHref }),
  );
}

/** Reads an image address into a data: URL, so the logo travels inside a saved SVG or a PNG render. Null if it can't be read. */
export async function logoDataUrl(href: string): Promise<string | undefined> {
  try {
    const res = await fetch(href);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise<string>((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => no(r.error);
      r.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

/** The logo address to use for a design: the workspace logo when the design asks for it and one exists. */
export const logoFor = (design: QrDesign, logoId: string | null | undefined) => (design.logo && logoId ? `/f/${logoId}` : undefined);

/** Rasterises a framed QR to a PNG blob, `width` px wide (default 2000, print quality). */
export async function framedPng(value: string, design: QrDesign, width = 2000, logoHref?: string): Promise<Blob> {
  const svg = framedSvgString(value, design, logoHref);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const h = Math.round((width * frameHeight(design.label)) / FRAME_W);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, h);
    ctx.drawImage(img, 0, 0, width, h);
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("PNG failed"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function saveBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const fileSafe = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "qr-code";
