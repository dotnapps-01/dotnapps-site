/** Constants the settings screen and its APIs share. Pure, so client components can import them. */

export const RETENTION = [
  { value: "24", label: "24 months", months: 24 },
  { value: "12", label: "12 months", months: 12 },
  { value: "forever", label: "Forever", months: null },
] as const;

export const EXPORTS = [
  { key: "contacts", label: "Contacts" },
  { key: "leads", label: "Leads" },
  { key: "tickets", label: "Tickets" },
  { key: "bookings", label: "Bookings" },
  { key: "reviews", label: "Ratings" },
  { key: "scans", label: "Scans" },
] as const;
export type ExportKey = (typeof EXPORTS)[number]["key"];
