"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { O } from "@/lib/ops-i18n";
import type { Lang } from "@/lib/review-i18n";
import { ErrorText, Shell, postJson, primaryBtn } from "@/components/engage/chrome";
import { Hero, Honeypot, Row, input } from "./parts";

/** A visitor asks for a pass. They are sent to their own pass page, which updates when the host decides. */
export function VisitorView({ code, business, location, initialLang, place }: { code: string; business: string; location: string; initialLang: Lang; place: string }) {
  const router = useRouter();
  const [lang, setLang] = useState(initialLang);
  const [v, setV] = useState({ name: "", phone: "", purpose: "", host: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const t = O[lang].visitor;
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setErrors({});
    setBusy(true);
    const r = await postJson("/api/s/visitor", { code, ...v });
    if (r.ok && r.data.token) return router.push(`/o/${r.data.token}?lang=${lang}`);
    setBusy(false);
    if (r.status === 422 && r.data.fields) return setErrors(r.data.fields);
    setError(r.status === 429 ? O[lang].tooMany : O[lang].error);
  }

  return (
    <Shell business={business} location={place ? `${place}${location ? ` · ${location}` : ""}` : location} lang={lang} onLang={setLang}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
        <Hero lang={lang} title={t.title} sub={t.sub} />
        <Row id="vi-name" label={t.name} error={errors.name}>
          <input id="vi-name" autoComplete="name" value={v.name} onChange={set("name")} aria-invalid={errors.name ? true : undefined} className={input(errors.name)} />
        </Row>
        <Row id="vi-phone" label={t.phone} error={errors.phone}>
          <input id="vi-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91" value={v.phone} onChange={set("phone")} aria-invalid={errors.phone ? true : undefined} className={input(errors.phone)} />
        </Row>
        <Row id="vi-purpose" label={t.purpose} error={errors.purpose}>
          <input id="vi-purpose" value={v.purpose} onChange={set("purpose")} aria-invalid={errors.purpose ? true : undefined} className={input(errors.purpose)} />
        </Row>
        <Row id="vi-host" label={t.host} error={errors.host}>
          <input id="vi-host" value={v.host} onChange={set("host")} aria-invalid={errors.host ? true : undefined} className={input(errors.host)} />
        </Row>
        <Honeypot value={v.website} onChange={(x) => setV((y) => ({ ...y, website: x }))} />
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? t.sending : t.submit}
        </button>
        <ErrorText>{error}</ErrorText>
      </form>
    </Shell>
  );
}
