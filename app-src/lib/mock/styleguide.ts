/** Sample data for /styleguide, taken from design/StyleGuide.dc.html. */

export const colors = [
  { n: "Ink", v: "#0E0E10", u: "text, buttons" },
  { n: "Graphite", v: "#3D3D45", u: "body text" },
  { n: "Muted", v: "#6B6B75", u: "labels" },
  { n: "Line", v: "#E7E7EB", u: "borders" },
  { n: "Mist", v: "#F1F1F3", u: "fills, badges" },
  { n: "Paper", v: "#FAFAFA", u: "page" },
  { n: "Sky", v: "#AFCBFF", u: "marble" },
  { n: "Blush", v: "#F6B8DA", u: "marble" },
  { n: "Lilac", v: "#CDBDFF", u: "marble" },
  { n: "Info", v: "#5B45B8", u: "info badges" },
];

export const status = [
  { n: "Success", t: "PAID", tone: "success" },
  { n: "Warning", t: "PENDING", tone: "warning" },
  { n: "Danger", t: "SLA BREACH", tone: "danger" },
  { n: "Info", t: "TRIAL", tone: "info" },
] as const;

export const typeScale = [
  { n: "Display · Inter Tight 600", cls: "font-display text-[64px] font-semibold tracking-display", e: "Every scan, a customer." },
  { n: "H1 · 40", cls: "font-display text-[40px] font-semibold tracking-heading", e: "Reviews and feedback" },
  { n: "H2 · 28", cls: "font-display text-[28px] font-semibold tracking-sub", e: "Rating split this month" },
  { n: "Body · Inter 16", cls: "font-sans text-[16px] font-normal", e: "Customers scan, rate and post on Google in under ten seconds." },
  { n: "Small · Inter 13", cls: "font-sans text-[13px] font-medium", e: "Last synced 2 minutes ago" },
  { n: "Label · 11 caps", cls: "font-sans text-[11px] font-semibold tracking-[0.06em]", e: "SCANS · LAST 30 DAYS" },
];

export const radii = ["8px", "12px", "16px", "24px", "999px"];

/** Sample URLs the QR examples encode (scannable). Also read by scripts/check-qr.mjs. */
export const qrSamples = [
  { label: "Square", variant: "square", value: "https://skn.to/demo-square" },
  { label: "Dot", variant: "dot", value: "https://skn.to/demo-dot" },
  { label: "Halftone", variant: "halftone", value: "https://skn.to/demo-halftone" },
] as const;

