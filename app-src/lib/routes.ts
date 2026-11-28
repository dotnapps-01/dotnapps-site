import type { Permission } from "@/lib/permissions";
import {
  ChartColumn,
  CalendarDays,
  Clock,
  Code,
  FileText,
  House,
  LayoutGrid,
  Package,
  Plus,
  QrCode,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Tag,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Single source of truth for every navigable route. */

export type SiteLink = { label: string; href: string };

export const siteNav: SiteLink[] = [
  { label: "Features", href: "/features" },
  { label: "Industries", href: "/industries" },
  { label: "Pricing", href: "/pricing" },
  { label: "API docs", href: "/docs" },
  { label: "Contact", href: "/contact" },
];

export const footerColumns: { heading: string; links: SiteLink[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "QR Studio", href: "/features" },
      { label: "Review Assistant", href: "/features/review-assistant" },
      { label: "Loyalty & offers", href: "/features" },
      { label: "Tickets & assets", href: "/features" },
      { label: "Product QR & warranty", href: "/features" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    heading: "Solutions",
    links: ["Retail", "Restaurants", "Clinics", "Real estate", "Manufacturers"].map((label) => ({
      label,
      href: "/industries",
    })),
  },
  {
    heading: "Developers",
    links: [
      { label: "API docs", href: "/docs" },
      { label: "Webhooks", href: "/docs" },
      { label: "White-label", href: "/docs" },
      { label: "Status", href: "/contact" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About Dotnapps", href: "/contact" },
      { label: "Contact", href: "/contact" },
      { label: "Book a demo", href: "/contact" },
      { label: "Partners", href: "/contact" },
    ],
  },
];

export type AppNavKey =
  | "dashboard"
  | "analytics"
  | "studio"
  | "library"
  | "pages"
  | "reviews"
  | "leads"
  | "offers"
  | "tickets"
  | "attendance"
  | "bookings"
  | "realestate"
  | "products"
  | "integrations"
  | "settings"
  | "admin";

export type AppNavItem = {
  key: AppNavKey;
  label: string;
  href: string;
  icon: LucideIcon;
  /** build phase that delivers the real screen (CLAUDE.md "Build order") */
  phase: number;
};

export const appNav: { heading: string; items: AppNavItem[] }[] = [
  {
    heading: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard", href: "/app/dashboard", icon: LayoutGrid, phase: 4 },
      { key: "analytics", label: "Analytics", href: "/app/analytics", icon: ChartColumn, phase: 4 },
    ],
  },
  {
    heading: "QR codes",
    items: [
      { key: "studio", label: "Create QR", href: "/app/studio", icon: Plus, phase: 4 },
      { key: "library", label: "QR Library", href: "/app/library", icon: QrCode, phase: 4 },
      { key: "pages", label: "Pages", href: "/app/pages", icon: FileText, phase: 6 },
    ],
  },
  {
    heading: "Engage",
    items: [
      { key: "reviews", label: "Reviews & feedback", href: "/app/reviews", icon: Star, phase: 5 },
      { key: "leads", label: "Leads & contacts", href: "/app/leads", icon: Users, phase: 6 },
      { key: "offers", label: "Offers & loyalty", href: "/app/offers", icon: Tag, phase: 6 },
    ],
  },
  {
    heading: "Operate",
    items: [
      { key: "tickets", label: "Tickets & assets", href: "/app/tickets", icon: Ticket, phase: 7 },
      { key: "attendance", label: "Attendance & visitors", href: "/app/attendance", icon: Clock, phase: 7 },
      { key: "bookings", label: "Bookings & events", href: "/app/bookings", icon: CalendarDays, phase: 7 },
      { key: "realestate", label: "Real estate plots", href: "/app/real-estate", icon: House, phase: 7 },
    ],
  },
  {
    heading: "Products",
    items: [
      { key: "products", label: "Product QR & warranty", href: "/app/products", icon: Package, phase: 8 },
    ],
  },
  {
    heading: "Platform",
    items: [
      { key: "integrations", label: "Integrations & API", href: "/app/integrations", icon: Code, phase: 8 },
      { key: "settings", label: "Settings", href: "/app/settings", icon: SlidersHorizontal, phase: 8 },
      { key: "admin", label: "Admin console", href: "/app/admin", icon: ShieldCheck, phase: 8 },
    ],
  },
];

/**
 * What a person needs to see each screen (any one of these will do). Screens not listed are open to every role.
 * The screens enforce the same rules themselves; this only keeps the sidebar from offering links that lead to "no access".
 */
export const navNeeds: Partial<Record<AppNavKey, Permission[]>> = {
  studio: ["build"],
  library: ["build"],
  pages: ["build"],
  reviews: ["reviews"],
  products: ["build"],
  integrations: ["owner"],
  settings: ["settings"],
};

export const appNavFlat: AppNavItem[] = appNav.flatMap((g) => g.items);
