"use client";

import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { E } from "@/lib/engage-i18n";
import { cn } from "@/lib/cn";
import { orderMessage, rupees, type MenuContent } from "@/lib/pages";
import { waDigits } from "@/lib/qr-types";
import type { Lang } from "@/lib/review-i18n";
import { Shell, displayH, outlineBtn, primaryBtn } from "./chrome";

function VegMark({ kind, label }: { kind: "veg" | "nonveg"; label: string }) {
  const c = kind === "veg" ? "#1F6B45" : "#A8321F";
  return (
    <span role="img" aria-label={label} className="inline-flex h-2.5 w-2.5 flex-none items-center justify-center rounded-[2px] border-[1.5px]" style={{ borderColor: c }}>
      <span className="h-1 w-1 rounded-full" style={{ background: c }} />
    </span>
  );
}

/** The customer's menu: sections, items, sold-out states and (if a WhatsApp number is set) a cart that becomes a WhatsApp order. */
export function MenuView({ business, location, title, content, initialLang, embedded }: { embedded?: boolean; business: string; location: string; title: string; content: MenuContent; initialLang: Lang }) {
  const [lang, setLang] = useState(initialLang);
  const [qty, setQty] = useState<Record<string, number>>({});
  const t = E[lang];
  const digits = content.whatsapp ? waDigits(content.whatsapp) : null;

  const lines = useMemo(
    () => content.sections.flatMap((s) => s.items).filter((i) => (qty[i.id] ?? 0) > 0).map((i) => ({ name: i.name, qty: qty[i.id], price: i.price })),
    [content, qty],
  );
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const total = lines.reduce((a, l) => a + (l.price ?? 0) * l.qty, 0);
  const bump = (id: string, d: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(20, (q[id] ?? 0) + d)) }));
  const waHref = digits ? `https://wa.me/${digits}?text=${encodeURIComponent(count ? orderMessage(business, lines) : `Hi ${business}!`)}` : "";

  return (
    <Shell business={business} location={location} lang={lang} onLang={setLang} embedded={embedded}>
      <div className="rounded-hero bg-marble px-5 py-6">
        {content.subtitle ? <div className="text-xs text-graphite">{content.subtitle}</div> : null}
        <h1 className={cn(displayH(lang), "mt-1 text-[28px]")}>{title}</h1>
      </div>

      {content.sections.length > 1 ? (
        <nav aria-label={t.menu.nav} className="sticky top-0 z-10 -mx-[22px] flex gap-1.5 overflow-x-auto bg-paper/95 px-[22px] py-2 backdrop-blur">
          {content.sections.map((s) => (
            <a key={s.id} href={`#sec-${s.id}`} className="whitespace-nowrap rounded-full border border-line bg-white px-3.5 py-2 text-[13px] font-medium text-ink no-underline hover:bg-mist">
              {s.name}
            </a>
          ))}
        </nav>
      ) : null}

      {content.sections.map((s) => (
        <section key={s.id} id={`sec-${s.id}`} aria-labelledby={`h-${s.id}`} className="scroll-mt-14">
          <h2 id={`h-${s.id}`} className="m-0 mb-1 mt-2 text-base font-semibold">
            {s.name}
          </h2>
          <ul className="m-0 list-none p-0">
            {s.items.map((i) => (
              <li key={i.id} className="flex items-start gap-3 border-b border-line-soft py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[14.5px] font-semibold">
                    {i.veg ? <VegMark kind={i.veg} label={i.veg === "veg" ? t.menu.veg : t.menu.nonveg} /> : null}
                    <span className={cn(!i.available && "text-muted line-through")}>{i.name}</span>
                  </div>
                  {i.description ? <div className="mt-0.5 text-xs text-muted">{i.description}</div> : null}
                  {i.tags.length ? <div className="mt-1 text-[11px] text-muted">{i.tags.join(" · ")}</div> : null}
                  <div className="mt-1 text-sm font-semibold">{i.price !== null ? rupees(i.price) : ""}</div>
                </div>
                {!i.available ? (
                  <span className="mt-1 rounded-full bg-danger-bg px-2.5 py-1 text-[11px] font-semibold text-danger-fg">{t.menu.soldOut}</span>
                ) : digits ? (
                  (qty[i.id] ?? 0) > 0 ? (
                    <div className="flex items-center gap-1" role="group" aria-label={i.name}>
                      <button type="button" aria-label={`${t.menu.remove}: ${i.name}`} onClick={() => bump(i.id, -1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-track bg-white">
                        <Minus size={14} aria-hidden="true" />
                      </button>
                      <span className="tabular w-6 text-center text-sm font-semibold" aria-live="polite">
                        {qty[i.id]}
                      </span>
                      <button type="button" aria-label={`${t.menu.add}: ${i.name}`} onClick={() => bump(i.id, 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-white">
                        <Plus size={14} aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" aria-label={`${t.menu.add}: ${i.name}`} onClick={() => bump(i.id, 1)} className="min-h-10 rounded-full border border-line bg-white px-4 text-[13px] font-medium hover:bg-mist">
                      {t.menu.add}
                    </button>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {digits ? (
        <div className="sticky bottom-3 z-10 mt-2">
          <a href={waHref} target="_blank" rel="noopener noreferrer" className={count ? primaryBtn : outlineBtn}>
            {count ? t.menu.order(count, total > 0 ? rupees(total) : "") : t.menu.orderWa}
          </a>
        </div>
      ) : null}
    </Shell>
  );
}
