/** Sample data for the app shell, taken from design/AppSidebar.dc.html. */
import type { AppNavKey } from "@/lib/routes";

export const sidebarBadges: Partial<Record<AppNavKey, string>> = {
  reviews: "6",
  leads: "12",
  tickets: "4",
};

export const locations = [
  { id: "anna-nagar", name: "Anna Nagar, Chennai" },
  { id: "rs-puram", name: "RS Puram, Coimbatore" },
  { id: "koramangala", name: "Koramangala, Bengaluru" },
];

export const plan = { name: "Growth", used: 38, limit: 50, upgradeTo: "Business" };

export const currentUser = { initials: "VR", name: "Vikas R", role: "Owner" };
