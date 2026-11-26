"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { BioContent } from "@/lib/pages";
import type { Lang } from "@/lib/review-i18n";
import { Shell, displayH, outlineBtn } from "./chrome";

/** Link-in-bio page. */
export function BioView({ business, location, title, content, initialLang, embedded }: { embedded?: boolean; business: string; location: string; title: string; content: BioContent; initialLang: Lang }) {
  const [lang, setLang] = useState(initialLang);
  return (
    <Shell business={business} location={location} lang={lang} onLang={setLang} embedded={embedded}>
      <div className="rounded-hero bg-marble px-5 py-7 text-center">
        <h1 className={cn(displayH(lang), "text-[26px]")}>{title}</h1>
        {content.headline ? <p className="mx-0 mb-0 mt-2 text-sm text-graphite">{content.headline}</p> : null}
      </div>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {content.links.map((l) => (
          <li key={l.url + l.label}>
            <a href={l.url} target="_blank" rel="noopener noreferrer" className={outlineBtn}>
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
