import { waDigits } from "@/lib/qr-types";
import { DEFAULT_CHIPS, DEFAULT_QUESTION, isLang, type Lang } from "./review-i18n";

/** Rating page settings (design/Reviews.dc.html, "Rating page settings"). Pure, shared by form and API. */
export type ReviewSettings = {
  question: string;
  chips: string[];
  languages: Lang[];
  /** who private feedback is for (alerts over WhatsApp arrive with Tickets) */
  managerPhone: string;
  suggestText: boolean;
  links: { label: string; url: string }[];
};

export const defaultSettings: ReviewSettings = {
  question: DEFAULT_QUESTION,
  chips: DEFAULT_CHIPS,
  languages: ["en", "ta", "hi"],
  managerPhone: "",
  suggestText: true,
  links: [],
};

const httpUrl = (v: string) => {
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};

export type SettingsResult = { ok: true; value: ReviewSettings } | { ok: false; fields: Record<string, string> };

export function parseReviewSettings(raw: unknown): SettingsResult {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const fields: Record<string, string> = {};

  const question = typeof r.question === "string" ? r.question.trim().slice(0, 120) : "";
  if (question.length < 3) fields.question = "Enter the question customers will see (3+ characters).";

  const chipsIn = Array.isArray(r.chips) ? r.chips : typeof r.chips === "string" ? r.chips.split(",") : [];
  const chips = [...new Set(chipsIn.map((c) => String(c).trim().slice(0, 24)).filter(Boolean))];
  if (chips.length < 1 || chips.length > 8) fields.chips = "Add between 1 and 8 chips, separated by commas.";

  const languages = (Array.isArray(r.languages) ? r.languages : []).filter(isLang).filter((l, i, a) => a.indexOf(l) === i) as Lang[];
  if (languages.length < 1) fields.languages = "Keep at least one language on.";

  let managerPhone = "";
  const phoneIn = typeof r.managerPhone === "string" ? r.managerPhone.trim() : "";
  if (phoneIn) {
    const d = waDigits(phoneIn);
    if (!d) fields.managerPhone = "Enter a valid number with country code.";
    else managerPhone = `+${d}`;
  }

  const links: ReviewSettings["links"] = [];
  (Array.isArray(r.links) ? r.links : []).slice(0, 2).forEach((l, i) => {
    const label = String((l as { label?: unknown })?.label ?? "").trim().slice(0, 30);
    const url = String((l as { url?: unknown })?.url ?? "").trim();
    if (!label && !url) return;
    const ok = httpUrl(url);
    if (!label) fields[`links.${i}.label`] = "Give the button a label.";
    else if (!ok) fields[`links.${i}.url`] = "Enter a valid web address.";
    else links.push({ label, url: ok });
  });

  if (Object.keys(fields).length) return { ok: false, fields };
  return { ok: true, value: { question, chips, languages, managerPhone, suggestText: r.suggestText !== false, links } };
}
