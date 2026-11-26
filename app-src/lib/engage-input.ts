import { waDigits } from "@/lib/qr-types";

/**
 * Validation for lead forms, coupons, the loyalty programme, lead submissions and contact import
 * (design/Leads.dc.html and Offers.dc.html). Pure TypeScript, shared by builders and APIs.
 */

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isoDate = (v: unknown) => {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
export const normPhone = (v: string): string | null => {
  const d = waDigits(v);
  return d ? `+${d}` : null;
};

export type Result<T> = { ok: true; value: T } | { ok: false; fields: Record<string, string> };
const fail = <T,>(fields: Record<string, string>): Result<T> => ({ ok: false, fields });

/* ---------- lead forms ---------- */

export const FORM_FIELDS = [
  { key: "email", label: "Email" },
  { key: "interest", label: "I am interested in (choices)" },
  { key: "time", label: "Preferred time" },
  { key: "message", label: "Message" },
] as const;
export type FormFieldKey = (typeof FORM_FIELDS)[number]["key"];

export type LeadFormInput = { title: string; intro: string; fields: FormFieldKey[]; interests: string[]; submitLabel: string; notifyPhone: string };

export function parseLeadForm(raw: unknown): Result<LeadFormInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const title = str(r.title, 80);
  if (title.length < 2) f.title = "Give the form a title (2+ characters).";
  const fields = (Array.isArray(r.fields) ? r.fields : []).filter((k): k is FormFieldKey => FORM_FIELDS.some((x) => x.key === k)).filter((k, i, a) => a.indexOf(k) === i);
  const interests = (Array.isArray(r.interests) ? r.interests : typeof r.interests === "string" ? r.interests.split(",") : [])
    .map((x) => String(x).trim().slice(0, 30))
    .filter(Boolean)
    .filter((x, i, a) => a.indexOf(x) === i)
    .slice(0, 8);
  if (fields.includes("interest") && interests.length < 2) f.interests = "Add at least two choices, separated by commas.";
  let notifyPhone = "";
  const n = str(r.notifyPhone, 30);
  if (n) {
    const p = normPhone(n);
    if (!p) f.notifyPhone = "Enter a valid number with country code.";
    else notifyPhone = p;
  }
  const submitLabel = str(r.submitLabel, 40) || "Request a callback";
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: { title, intro: str(r.intro, 200), fields, interests: fields.includes("interest") ? interests : [], submitLabel, notifyPhone } };
}

export type Submission = { name: string; phone: string; email: string; interest: string; time: string; message: string; optIn: boolean };

/** Validates what a customer typed into a lead form against that form's own definition. */
export function parseSubmission(raw: unknown, form: { fields: string[]; interests: string[] }): Result<Submission> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const name = str(r.name, 80);
  if (name.length < 2) f.name = "Enter your name.";
  const phone = normPhone(str(r.phone, 30));
  if (!phone) f.phone = "Enter a valid WhatsApp number.";
  const email = form.fields.includes("email") ? str(r.email, 120) : "";
  if (email && !EMAIL.test(email)) f.email = "Enter a valid email address.";
  const interest = form.fields.includes("interest") ? str(r.interest, 30) : "";
  if (interest && !form.interests.includes(interest)) f.interest = "Pick one of the choices.";
  if (Object.keys(f).length) return fail(f);
  return {
    ok: true,
    value: { name, phone: phone!, email, interest, time: form.fields.includes("time") ? str(r.time, 60) : "", message: form.fields.includes("message") ? str(r.message, 500) : "", optIn: r.optIn === true },
  };
}

/* ---------- coupons ---------- */

export type CouponInput = {
  title: string;
  headline: string;
  description: string;
  codePrefix: string;
  validDays: number;
  startsAt: string | null;
  endsAt: string | null;
  totalLimit: number | null;
  perCustomer: number;
  status: "active" | "paused";
};

export function parseCoupon(raw: unknown): Result<CouponInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const title = str(r.title, 60);
  if (title.length < 2) f.title = "Name the offer (2+ characters).";
  const headline = str(r.headline, 30);
  if (!headline) f.headline = "Add a short headline, like “20% off”.";
  const codePrefix = str(r.codePrefix, 8).toUpperCase().replace(/[^A-Z0-9]/g, "") || "SKN";
  if (codePrefix.length < 2) f.codePrefix = "Use 2–8 letters or numbers.";
  const validDays = Number(r.validDays ?? 7);
  if (!Number.isInteger(validDays) || validDays < 1 || validDays > 365) f.validDays = "Choose between 1 and 365 days.";
  const perCustomer = Number(r.perCustomer ?? 1);
  if (!Number.isInteger(perCustomer) || perCustomer < 1 || perCustomer > 20) f.perCustomer = "Choose between 1 and 20.";
  let totalLimit: number | null = null;
  if (r.totalLimit !== null && r.totalLimit !== undefined && r.totalLimit !== "") {
    const n = Number(r.totalLimit);
    if (!Number.isInteger(n) || n < 1 || n > 1_000_000) f.totalLimit = "Enter a whole number, or leave blank for no limit.";
    else totalLimit = n;
  }
  const startsAt = isoDate(r.startsAt);
  const endsAt = isoDate(r.endsAt);
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) f.endsAt = "The end must be after the start.";
  if (Object.keys(f).length) return fail(f);
  return {
    ok: true,
    value: { title, headline, description: str(r.description, 160), codePrefix, validDays, startsAt, endsAt, totalLimit, perCustomer, status: r.status === "paused" ? "paused" : "active" },
  };
}

/* ---------- loyalty programme ---------- */

export type LoyaltyInput = { name: string; stampsNeeded: number; reward: string; pin: string | null; expiresMonths: number | null; active: boolean };

export function parseLoyalty(raw: unknown, pinRequired: boolean): Result<LoyaltyInput> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f: Record<string, string> = {};
  const name = str(r.name, 40) || "Loyalty card";
  const stampsNeeded = Number(r.stampsNeeded);
  if (!Number.isInteger(stampsNeeded) || stampsNeeded < 2 || stampsNeeded > 30) f.stampsNeeded = "Choose between 2 and 30 stamps.";
  const reward = str(r.reward, 60);
  if (reward.length < 2) f.reward = "Describe the reward, like “1 free filter coffee”.";
  const pinIn = typeof r.pin === "string" ? r.pin.trim() : "";
  let pin: string | null = null;
  if (pinIn) {
    if (!/^\d{4}$/.test(pinIn)) f.pin = "The staff PIN must be exactly 4 digits.";
    else pin = pinIn;
  } else if (pinRequired) f.pin = "Set a 4-digit staff PIN so only your team can add stamps.";
  let expiresMonths: number | null = null;
  if (r.expiresMonths !== null && r.expiresMonths !== undefined && r.expiresMonths !== "") {
    const n = Number(r.expiresMonths);
    if (!Number.isInteger(n) || n < 1 || n > 60) f.expiresMonths = "Choose 1–60 months, or never.";
    else expiresMonths = n;
  }
  if (Object.keys(f).length) return fail(f);
  return { ok: true, value: { name, stampsNeeded, reward, pin, expiresMonths, active: r.active !== false } };
}

/* ---------- contact import ---------- */

export type ImportRow = { name: string; phone: string; email: string; tags: string[] };

export function parseImportRows(raw: unknown): { rows: ImportRow[]; skipped: { line: number; reason: string }[] } {
  const rows: ImportRow[] = [];
  const skipped: { line: number; reason: string }[] = [];
  const seen = new Set<string>();
  (Array.isArray(raw) ? raw.slice(0, 2000) : []).forEach((x, i) => {
    const r = (x ?? {}) as Record<string, unknown>;
    const phone = normPhone(str(r.phone, 30));
    if (!phone) return void skipped.push({ line: i + 1, reason: "invalid phone number" });
    if (seen.has(phone)) return void skipped.push({ line: i + 1, reason: "duplicate in file" });
    seen.add(phone);
    const email = str(r.email, 120);
    rows.push({
      name: str(r.name, 80),
      phone,
      email: EMAIL.test(email) ? email : "",
      tags: (typeof r.tags === "string" ? r.tags.split(/[;,|]/) : Array.isArray(r.tags) ? r.tags : []).map((t) => String(t).trim().slice(0, 20)).filter(Boolean).slice(0, 5),
    });
  });
  return { rows, skipped };
}

/** Minimal CSV parser (quotes, commas, newlines) for the contact import. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      cur.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cur.push(cell);
      cell = "";
      if (cur.some((c) => c.trim())) rows.push(cur);
      cur = [];
    } else cell += ch;
  }
  cur.push(cell);
  if (cur.some((c) => c.trim())) rows.push(cur);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

export type Stage = "new" | "contacted" | "qualified" | "won" | "lost";
export const STAGES: { key: Stage; label: string; line: string }[] = [
  { key: "new", label: "New", line: "#0E0E10" },
  { key: "contacted", label: "Contacted", line: "#0E0E10" },
  { key: "qualified", label: "Qualified", line: "#0E0E10" },
  { key: "won", label: "Won", line: "#1F7A4D" },
  { key: "lost", label: "Lost", line: "#9A9AA3" },
];

