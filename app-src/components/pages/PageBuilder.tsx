"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BioView } from "@/components/engage/BioView";
import { CardView } from "@/components/engage/CardView";
import { MenuView } from "@/components/engage/MenuView";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";
import type { PageRecord } from "@/lib/engage";
import { PAGE_KINDS, type BioContent, type CardContent, type MenuContent, type MenuItem, type MenuSection, type PageContent, type PageKind } from "@/lib/pages";

const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";
const control = "min-h-10 text-sm";
const uid = () => Math.random().toString(36).slice(2, 9);

type Errors = Record<string, string>;

/* ---------------- list + create ---------------- */

function PageList({ pages, selectedId }: { pages: PageRecord[]; selectedId: string | null }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<PageKind>("menu");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/pages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, title }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setTitle("");
      setAdding(false);
      router.push(`/app/pages?page=${j.id}`);
      router.refresh();
    } else setError(j.fields?.title ?? j.fields?.kind ?? "Couldn't create that page.");
  }

  return (
    <Card className="max-w-full flex-[1_1_220px]">
      <CardHeader>
        <CardTitle>Pages</CardTitle>
        <button type="button" aria-expanded={adding} onClick={() => setAdding((v) => !v)} className="inline-flex min-h-8 items-center rounded-full border border-ink px-3 text-[13px] font-medium hover:bg-mist">
          + New
        </button>
      </CardHeader>
      {adding ? (
        <form onSubmit={create} className="flex flex-col gap-2 border-b border-line-soft p-3">
          <Select label="Type" value={kind} onChange={(e) => setKind(e.target.value as PageKind)} labelClassName={label} className={control}>
            {PAGE_KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </Select>
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "card" ? "Meena S." : "Dinner menu"} error={error} labelClassName={label} className={control} autoFocus />
          <Button type="submit" size="sm" variant="primary">
            Create page
          </Button>
        </form>
      ) : null}
      <nav aria-label="Pages">
        {PAGE_KINDS.map((k) => {
          const items = pages.filter((p) => p.kind === k.key);
          if (items.length === 0) return null;
          return (
            <div key={k.key} className="pb-1 pt-2.5">
              <div className="k px-[18px] pb-1.5">{k.plural}</div>
              <ul className="m-0 list-none p-0">
                {items.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/app/pages?page=${p.id}`}
                      aria-current={p.id === selectedId ? "page" : undefined}
                      className={cn("flex items-center justify-between gap-2 px-[18px] py-[9px] text-[13.5px] text-ink no-underline hover:bg-paper", p.id === selectedId && "bg-mist font-semibold")}
                    >
                      <span className="truncate">{p.title}</span>
                      <span className="tabular flex-none text-[11px] text-muted">{p.status === "draft" ? "DRAFT" : p.scans30 >= 1000 ? `${(p.scans30 / 1000).toFixed(1)}K` : p.scans30}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {pages.length === 0 ? <p className="m-0 p-[18px] text-sm text-graphite">No pages yet. Create a menu, a business card or a link page.</p> : null}
      </nav>
    </Card>
  );
}

/* ---------------- editors ---------------- */

function MenuEditor({ value, onChange, errors }: { value: MenuContent; onChange: (v: MenuContent) => void; errors: Errors }) {
  const setSection = (i: number, patch: Partial<MenuSection>) => onChange({ ...value, sections: value.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const setItem = (si: number, ii: number, patch: Partial<MenuItem>) => setSection(si, { items: value.sections[si].items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) });
  const move = <T,>(arr: T[], i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return arr;
    const c = [...arr];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
        <Input label="Subtitle (shown above the title)" value={value.subtitle} onChange={(e) => onChange({ ...value, subtitle: e.target.value })} placeholder="Saravana Cafe · Anna Nagar" labelClassName={label} className={control} />
        <Input
          label="Order on WhatsApp number"
          value={value.whatsapp}
          onChange={(e) => onChange({ ...value, whatsapp: e.target.value })}
          placeholder="+91"
          error={errors.whatsapp}
          hint="Leave blank for a view-only menu."
          labelClassName={label}
          className={control}
        />
      </div>
      {errors.sections ? <p role="alert" className="m-0 text-sm text-danger-fg">{errors.sections}</p> : null}
      {value.sections.map((s, si) => (
        <section key={s.id} aria-label={`Edit section ${si + 1}`} className="rounded-input border border-line bg-paper p-3.5">
          <div className="flex flex-wrap items-end gap-2">
            <Input label={`Section ${si + 1} name`} value={s.name} onChange={(e) => setSection(si, { name: e.target.value })} error={errors[`sections.${si}.name`]} wrapperClassName="min-w-[160px] flex-1" labelClassName={label} className={control} />
            <button type="button" aria-label={`Move section ${s.name} up`} onClick={() => onChange({ ...value, sections: move(value.sections, si, -1) })} disabled={si === 0} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white disabled:opacity-40">
              <ArrowUp size={15} aria-hidden="true" />
            </button>
            <button type="button" aria-label={`Move section ${s.name} down`} onClick={() => onChange({ ...value, sections: move(value.sections, si, 1) })} disabled={si === value.sections.length - 1} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white disabled:opacity-40">
              <ArrowDown size={15} aria-hidden="true" />
            </button>
            <button type="button" aria-label={`Remove section ${s.name}`} onClick={() => onChange({ ...value, sections: value.sections.filter((_, j) => j !== si) })} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-danger-fg">
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </div>
          <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
            {s.items.map((it, ii) => (
              <li key={it.id} className="rounded-input border border-line bg-white p-3">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-2.5">
                  <Input label="Item name" value={it.name} onChange={(e) => setItem(si, ii, { name: e.target.value })} error={errors[`sections.${si}.items.${ii}.name`]} labelClassName={label} className={control} />
                  <Input label="Price (₹)" inputMode="decimal" value={it.price === null ? "" : String(it.price)} onChange={(e) => setItem(si, ii, { price: e.target.value === "" ? null : (e.target.value as unknown as number) })} error={errors[`sections.${si}.items.${ii}.price`]} labelClassName={label} className={control} />
                  <Select label="Type" value={it.veg} onChange={(e) => setItem(si, ii, { veg: e.target.value as MenuItem["veg"] })} labelClassName={label} className={control}>
                    <option value="">Not marked</option>
                    <option value="veg">Veg</option>
                    <option value="nonveg">Non-veg</option>
                  </Select>
                  <Input label="Tags" value={it.tags.join(", ")} onChange={(e) => setItem(si, ii, { tags: e.target.value.split(",").map((t) => t.trim()) })} placeholder="Bestseller, Spicy" labelClassName={label} className={control} />
                </div>
                <div className="mt-2.5 flex flex-wrap items-end gap-3">
                  <Input label="Description" value={it.description} onChange={(e) => setItem(si, ii, { description: e.target.value })} wrapperClassName="min-w-[200px] flex-1" labelClassName={label} className={control} />
                  <Toggle label={it.available ? "Available" : "Sold out today"} checked={it.available} onCheckedChange={(v) => setItem(si, ii, { available: v })} className="pb-2" />
                  <button type="button" aria-label={`Remove item ${it.name || ii + 1}`} onClick={() => setSection(si, { items: s.items.filter((_, j) => j !== ii) })} className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-full border border-line text-danger-fg">
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <Button size="sm" className="mt-3" onClick={() => setSection(si, { items: [...s.items, { id: uid(), name: "", description: "", price: null, veg: "", tags: [], available: true }] })}>
            <Plus size={13} aria-hidden="true" />
            Add item
          </Button>
        </section>
      ))}
      <div>
        <Button size="sm" onClick={() => onChange({ ...value, sections: [...value.sections, { id: uid(), name: "", items: [] }] })}>
          <Plus size={13} aria-hidden="true" />
          Add section
        </Button>
      </div>
    </div>
  );
}

function CardEditor({ value, onChange, errors }: { value: CardContent; onChange: (v: CardContent) => void; errors: Errors }) {
  const f = (k: keyof CardContent, text: string, extra: { type?: string; placeholder?: string } = {}) => (
    <Input key={k} label={text} value={value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.value })} error={errors[k]} labelClassName={label} className={control} {...extra} />
  );
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
      {f("name", "Name")}
      {f("role", "Role", { placeholder: "Sales Manager" })}
      {f("company", "Company")}
      {f("phone", "Phone", { type: "tel", placeholder: "+91" })}
      {f("whatsapp", "WhatsApp", { type: "tel", placeholder: "+91" })}
      {f("email", "Email", { type: "email" })}
      {f("website", "Website", { placeholder: "https://" })}
      {f("address", "Office address")}
    </div>
  );
}

function BioEditor({ value, onChange, errors }: { value: BioContent; onChange: (v: BioContent) => void; errors: Errors }) {
  const set = (i: number, patch: Partial<BioContent["links"][number]>) => onChange({ ...value, links: value.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  return (
    <div className="flex flex-col gap-3">
      <Input label="Headline" value={value.headline} onChange={(e) => onChange({ ...value, headline: e.target.value })} placeholder="Find us everywhere" labelClassName={label} className={control} />
      {value.links.map((l, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          <Input label={`Link ${i + 1} label`} value={l.label} onChange={(e) => set(i, { label: e.target.value })} error={errors[`links.${i}.label`]} wrapperClassName="min-w-[140px] flex-1" labelClassName={label} className={control} />
          <Input label={`Link ${i + 1} address`} value={l.url} onChange={(e) => set(i, { url: e.target.value })} placeholder="https://" error={errors[`links.${i}.url`]} wrapperClassName="min-w-[200px] flex-[2]" labelClassName={label} className={control} />
          <button type="button" aria-label={`Remove link ${i + 1}`} onClick={() => onChange({ ...value, links: value.links.filter((_, j) => j !== i) })} className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-full border border-line text-danger-fg">
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      ))}
      {errors["links.0.url"] && value.links.length === 0 ? <p role="alert" className="m-0 text-sm text-danger-fg">{errors["links.0.url"]}</p> : null}
      <div>
        <Button size="sm" onClick={() => onChange({ ...value, links: [...value.links, { label: "", url: "" }] })}>
          <Plus size={13} aria-hidden="true" />
          Add link
        </Button>
      </div>
    </div>
  );
}

/* ---------------- the editor shell + live preview ---------------- */

/** The editor keeps prices as typed; the preview needs numbers and skips half-filled items. */
function previewMenu(m: MenuContent): MenuContent {
  return {
    ...m,
    sections: m.sections.map((s) => ({
      ...s,
      items: s.items
        .filter((i) => i.name.trim())
        .map((i) => ({ ...i, price: i.price === null || String(i.price).trim() === "" ? null : Number(i.price) || 0, tags: i.tags.filter(Boolean) })),
    })),
  };
}

function Preview({ kind, title, content, business, location }: { kind: PageKind; title: string; content: PageContent; business: string; location: string }) {
  const common = { business, location, initialLang: "en" as const, embedded: true };
  return (
    <div className="flex h-[620px] w-[300px] max-w-full flex-col overflow-hidden rounded-[40px] border border-ink bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto" tabIndex={0} aria-label="Phone preview, scrollable">
        {kind === "menu" ? <MenuView {...common} title={title} content={previewMenu(content as MenuContent)} /> : null}
        {kind === "card" ? <CardView {...common} content={content as CardContent} /> : null}
        {kind === "bio" ? <BioView {...common} title={title} content={content as BioContent} /> : null}
      </div>
    </div>
  );
}

export function PageBuilder({ pages, selected, business, location }: { pages: PageRecord[]; selected: PageRecord | null; business: string; location: string }) {
  return (
    <div className="flex flex-wrap items-start gap-5 px-[clamp(16px,2.4vw,32px)] py-[clamp(16px,2.4vw,28px)]">
      <PageList pages={pages} selectedId={selected?.id ?? null} />
      {selected ? (
        <Editor key={selected.id + selected.updatedAt} page={selected} business={business} location={location} />
      ) : (
        <Card className="min-w-0 flex-[3_1_440px]">
          <CardHeader>
            <CardTitle>Build a page</CardTitle>
          </CardHeader>
          <ul className="m-0 grid list-none gap-3 p-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
            {PAGE_KINDS.map((k) => (
              <li key={k.key} className="border border-line p-4">
                <div className="text-sm font-semibold">{k.label}</div>
                <p className="mb-0 mt-1 text-[13px] text-graphite">{k.blurb}</p>
              </li>
            ))}
          </ul>
          <p className="m-0 px-5 pb-5 text-sm text-graphite">Use “+ New” on the left to start one. Then link it to a QR code from the QR Studio.</p>
        </Card>
      )}
    </div>
  );
}

function Editor({ page, business, location }: { page: PageRecord; business: string; location: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState<PageContent>(page.content);
  const [status, setStatus] = useState(page.status);
  const [errors, setErrors] = useState<Errors>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const kind = PAGE_KINDS.find((k) => k.key === page.kind)!;

  async function save(next: "draft" | "published") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/pages/${page.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, content, status: next }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setErrors({});
        setStatus(next);
        setMsg({ tone: "ok", text: next === "published" ? "Published. QR codes pointing at this page show these changes now." : "Saved as a draft." });
        router.refresh();
      } else {
        setErrors(j.fields ?? {});
        setMsg({ tone: "error", text: j.fields?.status ?? "Please fix the highlighted fields." });
      }
    } catch {
      setMsg({ tone: "error", text: "We couldn't reach the server. Please try again." });
    }
    setBusy(false);
  }

  async function remove() {
    if (!window.confirm(`Delete “${page.title}”? This can't be undone.`)) return;
    const res = await fetch(`/api/pages/${page.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/app/pages");
      router.refresh();
    } else setMsg({ tone: "error", text: res.status === 409 ? "A QR code still points at this page. Archive or re-point it first." : "Couldn't delete that page." });
  }

  const linkType = page.kind === "menu" ? "menu" : page.kind === "card" ? "vcard" : "bio";
  return (
    <>
      <Card className="min-w-0 flex-[2_1_440px]">
        <CardHeader>
          <CardTitle>
            {kind.label} <Pill tone={status === "published" ? "success" : "neutral"} className="ml-1 align-middle">{status === "published" ? "PUBLISHED" : "DRAFT"}</Pill>
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {status === "published" ? (
              <Link href={`/app/studio?type=${linkType}&ref=${page.id}`} className={buttonClasses({ size: "sm" })}>
                Link to QR
              </Link>
            ) : null}
            <Button size="sm" onClick={() => save("draft")} disabled={busy || (status === "published" && page.inUse > 0)} title={status === "published" && page.inUse > 0 ? "Live QR codes use this page" : undefined}>
              Save draft
            </Button>
            <Button size="sm" variant="primary" onClick={() => save("published")} disabled={busy}>
              {status === "published" ? "Publish changes" : "Publish"}
            </Button>
          </div>
        </CardHeader>
        <div className="flex flex-col gap-4 p-4">
          {msg ? (
            <p role={msg.tone === "error" ? "alert" : "status"} className={cn("m-0 rounded-input px-3.5 py-2.5 text-sm", msg.tone === "error" ? "bg-danger-bg text-danger-fg" : "bg-success-bg text-success-fg")}>
              {msg.text}
            </p>
          ) : null}
          <Input label="Page title" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} labelClassName={label} className={control} />
          {page.kind === "menu" ? <MenuEditor value={content as MenuContent} onChange={setContent} errors={errors} /> : null}
          {page.kind === "card" ? <CardEditor value={content as CardContent} onChange={setContent} errors={errors} /> : null}
          {page.kind === "bio" ? <BioEditor value={content as BioContent} onChange={setContent} errors={errors} /> : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <span className="text-xs text-muted">
              {page.inUse > 0 ? `${page.inUse} QR ${page.inUse === 1 ? "code points" : "codes point"} here · ${page.scans30} scans in 30 days` : "No QR code points here yet."}
            </span>
            <Button size="sm" onClick={remove}>
              Delete page
            </Button>
          </div>
        </div>
      </Card>
      <aside aria-label="Live preview" className="flex min-w-0 flex-[1_1_320px] justify-center">
        <Preview kind={page.kind} title={title} content={content} business={business} location={location} />
      </aside>
    </>
  );
}
