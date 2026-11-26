"use client";

import { Download, Globe, Mail, MessageCircle, Phone } from "lucide-react";
import { useState } from "react";
import { E } from "@/lib/engage-i18n";
import { cn } from "@/lib/cn";
import { buildVCard, initialsOf, type CardContent } from "@/lib/pages";
import { waDigits } from "@/lib/qr-types";
import type { Lang } from "@/lib/review-i18n";
import { Shell, displayH, outlineBtn, primaryBtn } from "./chrome";

/** A person's business card with a real vCard download. */
export function CardView({ business, location, content, initialLang, embedded }: { embedded?: boolean; business: string; location: string; content: CardContent; initialLang: Lang }) {
  const [lang, setLang] = useState(initialLang);
  const t = E[lang].card;
  const vcf = `data:text/vcard;charset=utf-8,${encodeURIComponent(buildVCard(content))}`;
  const wa = content.whatsapp ? waDigits(content.whatsapp) : null;
  const actions = [
    content.phone ? { href: `tel:${content.phone}`, label: t.call, icon: Phone, ext: false } : null,
    wa ? { href: `https://wa.me/${wa}`, label: t.whatsapp, icon: MessageCircle, ext: true } : null,
    content.email ? { href: `mailto:${content.email}`, label: t.email, icon: Mail, ext: false } : null,
    content.website ? { href: content.website, label: t.website, icon: Globe, ext: true } : null,
  ].filter(Boolean) as { href: string; label: string; icon: typeof Phone; ext: boolean }[];

  return (
    <Shell business={business} location={location} lang={lang} onLang={setLang} embedded={embedded}>
      <div className="mt-2 flex flex-col items-center gap-3 rounded-hero bg-marble px-5 py-8 text-center">
        <div aria-hidden="true" className="flex h-20 w-20 items-center justify-center rounded-3xl bg-ink text-2xl font-bold text-white">
          {initialsOf(content.name)}
        </div>
        <h1 className={cn(displayH(lang), "text-[28px]")}>{content.name}</h1>
        <p className="m-0 text-sm text-graphite">{[content.role, content.company].filter(Boolean).join(" · ")}</p>
      </div>
      <a href={vcf} download={`${content.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.vcf`} className={primaryBtn}>
        <Download size={16} aria-hidden="true" />
        {t.saveContact}
      </a>
      {actions.length ? (
        <div className="grid grid-cols-2 gap-2.5">
          {actions.map((a) => (
            <a key={a.label} href={a.href} {...(a.ext ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={outlineBtn}>
              <a.icon size={16} aria-hidden="true" />
              {a.label}
            </a>
          ))}
        </div>
      ) : null}
      {content.address ? (
        <div className="rounded-[18px] bg-thead p-3.5">
          <div className="tabular text-xs text-muted">{t.office}</div>
          <div className="mt-1 text-sm">{content.address}</div>
        </div>
      ) : null}
    </Shell>
  );
}
