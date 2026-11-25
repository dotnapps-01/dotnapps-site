import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRFramed, FRAME_W, frameHeight } from "@/components/qr/QRFramed";
import type { QrDesign } from "@/lib/qr-types";

/** Standalone SVG text for a framed QR (used for SVG downloads, PNG rendering and ZIPs). */
export function framedSvgString(value: string, design: QrDesign): string {
  return renderToStaticMarkup(
    createElement(QRFramed, { value, variant: design.variant, color: design.color, label: design.label, size: FRAME_W }),
  );
}

/** Rasterises a framed QR to a PNG blob, `width` px wide (default 2000, print quality). */
export async function framedPng(value: string, design: QrDesign, width = 2000): Promise<Blob> {
  const svg = framedSvgString(value, design);
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
