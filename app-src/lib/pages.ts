import { waDigits } from "@/lib/qr-types";

/**
 * Menus, business cards and link-in-bio pages (design/Pages.dc.html). Content is a JSON document
 * validated here. Pure TypeScript, shared by the builder (client) and the API (server).
 */

export type PageKind = "menu" | "card" | "bio";
export const PAGE_KINDS: { key: PageKind; label: string; plural: string; blurb: string }[] = [
  { key: "menu", label: "Menu / catalogue", plural: "Menus & catalogues", blurb: "Sections and items with prices, veg tags and sold-out switches." },
  { key: "card", label: "Business card", plural: "Business cards", blurb: "A tap-to-save contact page for a person." },
  { key: "bio", label: "Link-in-bio", plural: "Link-in-bio", blurb: "One page with all your links." },
];

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  /** rupees; null = price on request */
  price: number | null;
  veg: "" | "veg" | "nonveg";
  tags: string[];
  available: boolean;
};
export type MenuSection = { id: string; name: string; items: MenuItem[] };
export type MenuContent = { subtitle: string; whatsapp: string; sections: MenuSection[] };
export type CardContent = {
  name: string;
  role: string;
  company: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  address: string;
};
export type BioContent = { headline: string; links: { label: string; url: string }[] };
export type PageContent = MenuContent | CardContent | BioContent;

export const emptyContent = (kind: PageKind): PageContent =>
  kind === "menu"
    ? { subtitle: "", whatsapp: "", sections: [{ id: "s1", name: "Section 1", items: [] }] }
    : kind === "card"
      ? { name: "", role: "", company: "", phone: "", whatsapp: "", email: "", website: "", address: "" }
      : { headline: "", links: [{ label: "", url: "" }] };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const id = (v: unknown, fallback: string) => {
  const s = typeof v === "string" ? v.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24) : "";
  return s || fallback;
};
const httpUrl = (v: string) => {
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const LIMITS = { sections: 20, items: 100, links: 20, tags: 5 };

export type ParseResult<T> = { ok: true; value: T } | { ok: false; fields: Record<string, string> };

export function parseTitle(v: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const t = str(v, 80);
  return t.length >= 2 ? { ok: true, value: t } : { ok: false, error: "Give this page a title (2+ characters)." };
}

function parseMenu(r: Record<string, unknown>): ParseResult<MenuContent> {
  const fields: Record<string, string> = {};
  let whatsapp = "";
  const wa = str(r.whatsapp, 30);
  if (wa) {
    const d = waDigits(wa);
    if (!d) fields.whatsapp = "Enter a valid WhatsApp number with country code.";
    else whatsapp = `+${d}`;
  }
  const sectionsIn = Array.isArray(r.sections) ? r.sections.slice(0, LIMITS.sections) : [];
  const sections: MenuSection[] = [];
  sectionsIn.forEach((s, si) => {
    const sr = (s ?? {}) as Record<string, unknown>;
    const name = str(sr.name, 40);
    if (!name) {
      fields[`sections.${si}.name`] = "Name this section.";
      return;
    }
    const items: MenuItem[] = [];
    (Array.isArray(sr.items) ? sr.items.slice(0, LIMITS.items) : []).forEach((it, ii) => {
      const ir = (it ?? {}) as Record<string, unknown>;
      const iname = str(ir.name, 60);
      if (!iname) {
        fields[`sections.${si}.items.${ii}.name`] = "Name this item.";
        return;
      }
      let price: number | null = null;
      if (ir.price !== null && ir.price !== undefined && ir.price !== "") {
        const n = Number(ir.price);
        if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
          fields[`sections.${si}.items.${ii}.price`] = "Enter a valid price.";
          return;
        }
        price = Math.round(n * 100) / 100;
      }
      items.push({
        id: id(ir.id, `i${si}-${ii}`),
        name: iname,
        description: str(ir.description, 160),
        price,
        veg: ir.veg === "veg" || ir.veg === "nonveg" ? ir.veg : "",
        tags: (Array.isArray(ir.tags) ? ir.tags : typeof ir.tags === "string" ? ir.tags.split(",") : [])
          .map((t) => String(t).trim().slice(0, 20))
          .filter(Boolean)
          .slice(0, LIMITS.tags),
        available: ir.available !== false,
      });
    });
    sections.push({ id: id(sr.id, `s${si}`), name, items });
  });
  if (Object.keys(fields).length) return { ok: false, fields };
  return { ok: true, value: { subtitle: str(r.subtitle, 80), whatsapp, sections } };
}

function parseCard(r: Record<string, unknown>): ParseResult<CardContent> {
  const fields: Record<string, string> = {};
  const name = str(r.name, 80);
  if (name.length < 2) fields.name = "Enter the person's name.";
  const phoneRaw = str(r.phone, 30);
  const waRaw = str(r.whatsapp, 30);
  let phone = "";
  let whatsapp = "";
  if (phoneRaw) {
    const d = waDigits(phoneRaw);
    if (!d) fields.phone = "Enter a valid number with country code.";
    else phone = `+${d}`;
  }
  if (waRaw) {
    const d = waDigits(waRaw);
    if (!d) fields.whatsapp = "Enter a valid number with country code.";
    else whatsapp = `+${d}`;
  }
  const email = str(r.email, 120);
  if (email && !EMAIL.test(email)) fields.email = "Enter a valid email address.";
  const webRaw = str(r.website, 200);
  let website = "";
  if (webRaw) {
    const u = httpUrl(webRaw);
    if (!u) fields.website = "Enter a valid web address.";
    else website = u;
  }
  if (!phone && !whatsapp && !email && !website && !fields.name) fields.phone = "Add at least one way to reach this person.";
  if (Object.keys(fields).length) return { ok: false, fields };
  return { ok: true, value: { name, role: str(r.role, 80), company: str(r.company, 80), phone, whatsapp, email, website, address: str(r.address, 240) } };
}

function parseBio(r: Record<string, unknown>): ParseResult<BioContent> {
  const fields: Record<string, string> = {};
  const links: BioContent["links"] = [];
  (Array.isArray(r.links) ? r.links.slice(0, LIMITS.links) : []).forEach((l, i) => {
    const lr = (l ?? {}) as Record<string, unknown>;
    const label = str(lr.label, 40);
    const urlRaw = str(lr.url, 300);
    if (!label && !urlRaw) return;
    const url = httpUrl(urlRaw);
    if (!label) fields[`links.${i}.label`] = "Give the link a label.";
    else if (!url) fields[`links.${i}.url`] = "Enter a valid web address.";
    else links.push({ label, url });
  });
  if (!Object.keys(fields).length && links.length === 0) fields["links.0.url"] = "Add at least one link.";
  if (Object.keys(fields).length) return { ok: false, fields };
  return { ok: true, value: { headline: str(r.headline, 120), links } };
}

/** Validates and normalises a page document. `strict` (publishing) additionally requires some content. */
export function parseContent(kind: PageKind, raw: unknown, strict: boolean): ParseResult<PageContent> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const res = kind === "menu" ? parseMenu(r) : kind === "card" ? parseCard(r) : parseBio(r);
  if (!res.ok) return res;
  if (strict && kind === "menu" && !(res.value as MenuContent).sections.some((s) => s.items.length > 0)) {
    return { ok: false, fields: { sections: "Add at least one item before publishing." } };
  }
  return res;
}

/* ---------- helpers for the public pages ---------- */

const vEsc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");

/** A vCard 3.0 file for "Save contact". */
export function buildVCard(c: CardContent): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${vEsc(c.name)}`];
  if (c.company) lines.push(`ORG:${vEsc(c.company)}`);
  if (c.role) lines.push(`TITLE:${vEsc(c.role)}`);
  if (c.phone) lines.push(`TEL;TYPE=CELL:${c.phone}`);
  if (c.whatsapp && c.whatsapp !== c.phone) lines.push(`TEL;TYPE=CELL,VOICE:${c.whatsapp}`);
  if (c.email) lines.push(`EMAIL:${vEsc(c.email)}`);
  if (c.website) lines.push(`URL:${c.website}`);
  if (c.address) lines.push(`ADR;TYPE=WORK:;;${vEsc(c.address)};;;;`);
  lines.push("END:VCARD");
  return lines.join("\r\n") + "\r\n";
}

export const rupees = (n: number) => `₹${Number.isInteger(n) ? n.toLocaleString("en-IN") : n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

/** The text of a WhatsApp order: items with quantities and the total. */
export function orderMessage(business: string, lines: { name: string; qty: number; price: number | null }[]): string {
  const body = lines.map((l) => `${l.qty} × ${l.name}${l.price !== null ? ` (${rupees(l.price * l.qty)})` : ""}`).join("\n");
  const total = lines.reduce((a, l) => a + (l.price ?? 0) * l.qty, 0);
  return `Hi ${business}! I'd like to order:\n${body}${total > 0 ? `\nTotal: ${rupees(total)}` : ""}`;
}

export const initialsOf = (name: string) => (name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") || "S").toUpperCase();
