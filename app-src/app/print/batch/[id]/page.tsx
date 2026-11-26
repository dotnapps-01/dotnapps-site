import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/products/PrintButton";
import { QRMark } from "@/components/qr/QRMark";
import { currentWorkspace } from "@/lib/auth/current";
import { canUse } from "@/lib/plans";
import { batchCodes, getBatch } from "@/lib/products";
import { getShortLinkBase } from "@/lib/short-link";

export const metadata: Metadata = { title: "Print product codes", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const PER_PAGE = 60;

/** A printable sheet of a batch's QR codes, 60 to a page, each with its serial. Use the browser's Print (or Save as PDF). */
export default async function PrintBatch({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) redirect("/login");
  if (!canUse(ws.plan, "products")) notFound();
  const { id } = await params;
  const batch = await getBatch(ws.id, id);
  if (!batch) notFound();
  const pages = Math.max(1, Math.ceil(batch.qty / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number((await searchParams).page) || 1));
  const { base } = await getShortLinkBase();
  const origin = process.env.SHORT_LINK_BASE?.replace(/\/+$/, "") ?? base.replace(/\/q$/, "");
  const codes = await batchCodes(ws.id, batch.id, (page - 1) * PER_PAGE, PER_PAGE);
  const cell = batch.format === "label" ? 30 : 32; // mm

  return (
    <main id="main" className="mx-auto max-w-[900px] px-4 py-6 print:max-w-none print:p-0">
      <style>{`@page { size: A4; margin: 10mm; } @media print { body { background: #fff !important; } }`}</style>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <div className="k">{batch.product}</div>
          <h1 className="m-0 font-display text-2xl font-semibold tracking-display">{`${batch.label} · page ${page} of ${pages}`}</h1>
          <p className="mb-0 mt-1 text-sm text-graphite">{`${batch.firstSerial} to ${batch.lastSerial}. Print at 100% scale, not "fit to page", so each code stays ${cell} mm.`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {page > 1 ? (
            <Link href={`/print/batch/${batch.id}?page=${page - 1}`} className="inline-flex min-h-10 items-center rounded-full border border-ink px-4 text-sm font-medium text-ink no-underline">
              ← Previous
            </Link>
          ) : null}
          {page < pages ? (
            <Link href={`/print/batch/${batch.id}?page=${page + 1}`} className="inline-flex min-h-10 items-center rounded-full border border-ink px-4 text-sm font-medium text-ink no-underline">
              Next →
            </Link>
          ) : null}
          <Link href="/app/products?tab=batches" className="inline-flex min-h-10 items-center rounded-full border border-ink px-4 text-sm font-medium text-ink no-underline">
            Back to batches
          </Link>
          <PrintButton />
        </div>
      </div>
      <ul className="m-0 grid list-none justify-center gap-[3mm] p-0" style={{ gridTemplateColumns: `repeat(auto-fill, ${cell}mm)` }}>
        {codes.map((c) => (
          <li key={c.serial} style={{ width: `${cell}mm`, height: `${cell + 5}mm`, breakInside: "avoid" }} className="flex flex-col items-center justify-start border border-line p-[1.5mm] print:border-0">
            <QRMark value={`${origin}/p/${c.token}`} size={Math.round(cell * 3.2)} variant="square" label={`QR code for ${c.serial}`} className="h-auto w-full" />
            <span className="tabular mt-[0.5mm] text-center text-[6.5pt] leading-none">{c.serial}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
