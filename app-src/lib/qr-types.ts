/**
 * QR type catalogue, validation and destination building. Pure TypeScript: shared by the Studio
 * (client) and the API / redirect service (server) so both apply the same rules.
 * Types and icons come from design/QRStudio.dc.html.
 */

export type QrGroup = "Basic" | "Engage" | "Operate" | "Advanced";

export type FieldDef = {
  key: string;
  label: string;
  placeholder: string;
  kind?: "text" | "url" | "tel" | "password" | "number" | "select";
  options?: string[];
  required?: boolean;
  hint?: string;
};

export type QrTypeDef = {
  key: string;
  label: string;
  group: QrGroup;
  icon: string;
  /** false until the customer page for this type is built (the build phase is in `phase`) */
  live: boolean;
  phase?: number;
  /** encodes its data directly, so it can never be dynamic (no short link, no scan tracking) */
  staticOnly?: boolean;
  fields: FieldDef[];
};

const ic = {
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  menu: "M4 5h16M4 12h16M4 19h10",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
  tag: "M3 12V4h8l10 10-8 8zM7.5 7.5h.01",
  stamp: "M12 21a9 9 0 100-18 9 9 0 000 18zM8 12l3 3 5-6",
  card: "M3 5h18v14H3zM7 9h4M7 13h6M15 9h2v4h-2z",
  link: "M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1",
  bill: "M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6",
  globe: "M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18",
  chat: "M21 12a8 8 0 01-11.6 7.1L3 21l1.9-6.2A8 8 0 1121 12z",
  pay: "M6 4h12M6 9h12M6 4c6 0 8 2.5 8 5s-2 5-8 5l8 7",
  wifi: "M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0M12 19.5h.01",
  pin: "M12 21s-7-6.5-7-12a7 7 0 0114 0c0 5.5-7 12-7 12zM12 11a2 2 0 100-4 2 2 0 000 4z",
  file: "M6 2h9l5 5v15H6zM14 2v6h6",
  ticket: "M4 7h16v4a2 2 0 000 4v4H4v-4a2 2 0 000-4z",
  wrench: "M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  cal: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  home: "M3 11l9-7 9 7v9H3zM9 20v-6h6v6",
  box: "M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10",
  badge: "M4 4h16v16H4zM9 9a3 3 0 106 0 3 3 0 00-6 0M7 18a5 5 0 0110 0",
};

export const qrGroups: { key: QrGroup; plan: string; tone: "neutral" | "info" | "ink" }[] = [
  { key: "Basic", plan: "FREE", tone: "neutral" },
  { key: "Engage", plan: "STARTER+", tone: "info" },
  { key: "Operate", plan: "GROWTH+", tone: "ink" },
  { key: "Advanced", plan: "ENTERPRISE", tone: "ink" },
];

export const qrTypes: QrTypeDef[] = [
  { key: "url", label: "Website", group: "Basic", icon: ic.globe, live: true, fields: [
    { key: "url", label: "Website URL", placeholder: "https://", kind: "url", required: true },
  ] },
  { key: "wa", label: "WhatsApp chat", group: "Basic", icon: ic.chat, live: true, fields: [
    { key: "number", label: "WhatsApp number", placeholder: "+91", kind: "tel", required: true },
    { key: "message", label: "Pre-filled message", placeholder: "Hi! I scanned your QR" },
  ] },
  { key: "upi", label: "UPI payment", group: "Basic", icon: ic.pay, live: true, staticOnly: true, fields: [
    { key: "vpa", label: "UPI ID", placeholder: "business@upi", required: true },
    { key: "name", label: "Payee name", placeholder: "Saravana Cafe" },
    { key: "amount", label: "Amount (optional)", placeholder: "₹", kind: "number" },
  ] },
  { key: "wifi", label: "Wi-Fi", group: "Basic", icon: ic.wifi, live: true, staticOnly: true, fields: [
    { key: "ssid", label: "Network name", placeholder: "Cafe_Guest", required: true },
    { key: "password", label: "Password", placeholder: "••••••••", kind: "password" },
    { key: "security", label: "Security", placeholder: "", kind: "select", options: ["WPA/WPA2", "WEP", "None"] },
  ] },
  { key: "maps", label: "Google Maps", group: "Basic", icon: ic.pin, live: true, fields: [
    { key: "query", label: "Google Maps link or address", placeholder: "Search an address or paste a link", required: true },
  ] },
  { key: "pdf", label: "PDF / file", group: "Basic", icon: ic.file, live: true, fields: [
    { key: "url", label: "Link to the PDF or file", placeholder: "https://", kind: "url", required: true, hint: "File upload arrives with Pages. For now, link to a hosted file." },
  ] },

  { key: "review", label: "Review page", group: "Engage", icon: ic.star, live: false, phase: 5, fields: [] },
  { key: "menu", label: "Menu / catalogue", group: "Engage", icon: ic.menu, live: false, phase: 6, fields: [] },
  { key: "lead", label: "Lead form", group: "Engage", icon: ic.user, live: false, phase: 6, fields: [] },
  { key: "coupon", label: "Coupon", group: "Engage", icon: ic.tag, live: false, phase: 6, fields: [] },
  { key: "loyalty", label: "Loyalty card", group: "Engage", icon: ic.stamp, live: false, phase: 6, fields: [] },
  { key: "vcard", label: "Business card", group: "Engage", icon: ic.card, live: false, phase: 6, fields: [] },
  { key: "bio", label: "Link-in-bio", group: "Engage", icon: ic.link, live: false, phase: 6, fields: [] },
  { key: "bill", label: "Digital bill", group: "Engage", icon: ic.bill, live: false, phase: 6, fields: [] },

  { key: "ticket", label: "Feedback → ticket", group: "Operate", icon: ic.ticket, live: false, phase: 7, fields: [] },
  { key: "asset", label: "Asset service", group: "Operate", icon: ic.wrench, live: false, phase: 7, fields: [] },
  { key: "attend", label: "Attendance point", group: "Operate", icon: ic.clock, live: false, phase: 7, fields: [] },
  { key: "visitor", label: "Visitor pass", group: "Operate", icon: ic.badge, live: false, phase: 7, fields: [] },
  { key: "booking", label: "Booking / event", group: "Operate", icon: ic.cal, live: false, phase: 7, fields: [] },
  { key: "plot", label: "Real estate plot", group: "Operate", icon: ic.home, live: false, phase: 7, fields: [] },

  { key: "product", label: "Product (serialized)", group: "Advanced", icon: ic.box, live: false, phase: 8, fields: [] },
];

export const typeByKey = (key: string) => qrTypes.find((t) => t.key === key);
export const typeLabel = (key: string) => typeByKey(key)?.label ?? key;

/* ---------- design ---------- */

export type QrVariant = "square" | "dot" | "halftone";
export type QrDesign = { color: string; variant: QrVariant; label: string };

export const designColors = [
  { name: "Ink", value: "#0E0E10" },
  { name: "Lilac", value: "#5B45B8" },
  { name: "Forest", value: "#1F6B45" },
  { name: "Maroon", value: "#8E2440" },
  { name: "Brown", value: "#5A3A1E" },
];
export const designVariants: { key: QrVariant; label: string }[] = [
  { key: "square", label: "Square" },
  { key: "dot", label: "Dots" },
  { key: "halftone", label: "Halftone" },
];
export const frameLabels = ["SCAN TO REVIEW US", "SCAN FOR MENU", "SCAN TO PAY", "SCAN ME", ""];
export const defaultDesign: QrDesign = { color: "#0E0E10", variant: "dot", label: "SCAN ME" };

function luminance(hex: string) {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
/** WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function contrastRatio(a: string, b = "#FFFFFF") {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
export const MIN_QR_CONTRAST = 4.5;

/* ---------- destinations ---------- */

const digitsOf = (s: string) => s.replace(/\D/g, "");

/** Normalises a phone to international digits; bare 10-digit numbers are treated as Indian. */
export function waDigits(input: string): string | null {
  let d = digitsOf(input);
  if (d.length === 10) d = "91" + d;
  if (d.length === 11 && d.startsWith("0")) d = "91" + d.slice(1);
  return d.length >= 11 && d.length <= 15 ? d : null;
}

function httpUrl(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

const wifiEscape = (s: string) => s.replace(/([\;,:"])/g, "\\$1");

/** Where a dynamic code sends people. Always http(s). */
export function destinationFor(type: string, config: Record<string, string>): string | null {
  switch (type) {
    case "url":
    case "pdf":
      return httpUrl(config.url ?? "");
    case "wa": {
      const d = waDigits(config.number ?? "");
      if (!d) return null;
      const text = (config.message ?? "").trim();
      return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
    }
    case "maps": {
      const q = (config.query ?? "").trim();
      if (!q) return null;
      const asUrl = /^(https?:\/\/|maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.[a-z.]+\/maps)/i.test(q) ? httpUrl(q) : null;
      return asUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
    }
    default:
      return null;
  }
}

/** What a static code encodes directly (no short link, so scans can't be counted). */
export function staticPayload(type: string, config: Record<string, string>): string | null {
  switch (type) {
    case "upi": {
      const vpa = (config.vpa ?? "").trim();
      if (!vpa) return null;
      const p = new URLSearchParams({ pa: vpa });
      if (config.name?.trim()) p.set("pn", config.name.trim());
      if (config.amount?.trim()) p.set("am", config.amount.trim());
      p.set("cu", "INR");
      return `upi://pay?${p.toString().replace(/\+/g, "%20")}`;
    }
    case "wifi": {
      const ssid = (config.ssid ?? "").trim();
      if (!ssid) return null;
      const sec = config.security === "None" ? "nopass" : config.security === "WEP" ? "WEP" : "WPA";
      const pass = sec === "nopass" ? "" : `P:${wifiEscape(config.password ?? "")};`;
      return `WIFI:T:${sec};S:${wifiEscape(ssid)};${pass};`;
    }
    default:
      return destinationFor(type, config);
  }
}

/* ---------- short codes ---------- */

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function randomShortCode(length = 7) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}
const RESERVED = new Set(["preview", "api", "app", "admin", "login", "signup", "static", "status", "q", "www", "demo", "test"]);
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,31}$/;
export function slugError(slug: string): string | null {
  if (!SLUG_RE.test(slug)) return "Use 3–32 lowercase letters, numbers or hyphens.";
  if (RESERVED.has(slug)) return "That short link is reserved.";
  return null;
}

/* ---------- status & plans ---------- */

export type StoredStatus = "draft" | "active" | "paused" | "archived";
export type EffectiveStatus = StoredStatus | "scheduled" | "expired";

export function effectiveStatus(row: { status: StoredStatus; starts_at: string | Date | null; ends_at: string | Date | null }, now = new Date()): EffectiveStatus {
  if (row.status !== "active") return row.status;
  if (row.starts_at && new Date(row.starts_at) > now) return "scheduled";
  if (row.ends_at && new Date(row.ends_at) <= now) return "expired";
  return "active";
}

/** Dynamic QR codes included per plan (see /pricing). Static codes are unlimited. */
export const dynamicLimit: Record<string, number> = { free: 3, starter: 25, growth: 100, business: Infinity, enterprise: Infinity };

/* ---------- input parsing (shared client + server) ---------- */

export type QrInput = {
  name: string;
  type: string;
  dynamic: boolean;
  locationId: string | null;
  folderId: string | null;
  config: Record<string, string>;
  design: QrDesign;
  shortCode: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

export type ParseResult = { ok: true; value: QrInput } | { ok: false; fields: Record<string, string> };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
const isoDate = (v: unknown) => {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/**
 * Validates and normalises a QR definition. `publish` applies the full rules; a draft only needs a
 * name and type, but anything that is filled in must still be well-formed.
 */
export function parseQrInput(raw: unknown, publish: boolean): ParseResult {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const fields: Record<string, string> = {};

  const name = str(r.name, 120);
  if (name.length < 2) fields.name = "Give this QR code a name (2+ characters).";

  const type = typeByKey(str(r.type, 40));
  if (!type) fields.type = "Choose what the scan should do.";
  else if (!type.live) fields.type = `${type.label} pages arrive in Phase ${type.phase}.`;

  const dynamic = type?.staticOnly ? false : r.dynamic !== false;

  const config: Record<string, string> = {};
  const incoming = (r.config && typeof r.config === "object" ? r.config : {}) as Record<string, unknown>;
  for (const f of type?.fields ?? []) {
    const v = str(incoming[f.key], 500);
    if (f.kind === "select" && v && !f.options?.includes(v)) continue;
    config[f.key] = v;
    if (!v) {
      if (publish && f.required) fields[`config.${f.key}`] = `${f.label} is required.`;
      continue;
    }
    if (f.kind === "url" && !httpUrl(v)) fields[`config.${f.key}`] = "Enter a valid web address (http or https).";
    if (f.kind === "tel" && !waDigits(v)) fields[`config.${f.key}`] = "Enter a valid number with country code.";
    if (f.kind === "number" && !(Number(v) > 0 && Number(v) < 1e7)) fields[`config.${f.key}`] = "Enter a valid amount.";
    if (type?.key === "upi" && f.key === "vpa" && !/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/.test(v)) fields[`config.${f.key}`] = "Enter a valid UPI ID, like name@bank.";
  }
  if (type?.key === "maps" && config.query && !destinationFor("maps", config)) fields["config.query"] = "Enter an address or a Google Maps link.";

  const d = (r.design && typeof r.design === "object" ? r.design : {}) as Record<string, unknown>;
  const color = str(d.color, 7).toUpperCase();
  const design: QrDesign = {
    color: /^#[0-9A-F]{6}$/.test(color) ? color : defaultDesign.color,
    variant: designVariants.some((v) => v.key === d.variant) ? (d.variant as QrVariant) : defaultDesign.variant,
    label: frameLabels.includes(str(d.label, 40)) ? str(d.label, 40) : defaultDesign.label,
  };
  if (contrastRatio(design.color) < MIN_QR_CONTRAST) fields.design = "That colour is too light to scan reliably. Pick a darker one.";

  let shortCode: string | null = null;
  if (dynamic) {
    const s = str(r.shortCode, 32).toLowerCase();
    if (s) {
      const e = slugError(s);
      if (e) fields.shortCode = e;
      else shortCode = s;
    }
  }

  const startsAt = dynamic ? isoDate(r.startsAt) : null;
  const endsAt = dynamic ? isoDate(r.endsAt) : null;
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) fields.endsAt = "The end must be after the start.";

  if (Object.keys(fields).length) return { ok: false, fields };
  return {
    ok: true,
    value: { name, type: type!.key, dynamic, locationId: uuid(r.locationId), folderId: uuid(r.folderId), config, design, shortCode, startsAt, endsAt },
  };
}

/** The text a code encodes: its short link when dynamic, otherwise its direct payload. */
export function qrValue(row: { dynamic: boolean; shortCode: string | null; type: string; config: Record<string, string> }, shortBase: string): string {
  if (row.dynamic && row.shortCode) return `${shortBase}/${row.shortCode}`;
  return staticPayload(row.type, row.config) ?? "";
}
