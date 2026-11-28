/**
 * Who may do what. Pure TypeScript (no server imports) so the screens and the API share one table.
 * Three roles, as in design/Settings.dc.html: Owner, Manager and Staff.
 */

export type Role = "owner" | "manager" | "staff";
export const ROLES: Role[] = ["owner", "manager", "staff"];
export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", manager: "Manager", staff: "Staff" };
export const isRole = (v: unknown): v is Role => v === "owner" || v === "manager" || v === "staff";
/** Roles that can be given to a team member (there is always exactly one Owner). */
export type MemberRole = Exclude<Role, "owner">;
export const MEMBER_ROLES: MemberRole[] = ["manager", "staff"];
export const isMemberRole = (v: unknown): v is MemberRole => v === "manager" || v === "staff";

export type Permission =
  | "build" //     create and edit QR codes, pages, forms, offers and every module's set-up
  | "reviews" //   the reviews inbox and replying to feedback
  | "analytics" // look at the numbers
  | "export" //    download data as CSV
  | "work" //      handle leads, tickets, bookings, visitors, plots
  | "redeem" //    redeem coupons and stamp loyalty cards
  | "invite" //    add and remove team members
  | "settings" //  business profile, locations, logo and files
  | "owner"; //    billing and plan, API keys and webhooks, data retention, deleting the workspace, the audit log

const BOTH: Role[] = ["owner", "manager"];
const ALL: Role[] = ["owner", "manager", "staff"];
const RULES: Record<Permission, Role[]> = {
  build: BOTH,
  reviews: BOTH,
  analytics: ALL,
  export: BOTH,
  work: ALL,
  redeem: ALL,
  invite: BOTH,
  settings: BOTH,
  owner: ["owner"],
};

export const can = (role: Role, p: Permission): boolean => RULES[p].includes(role);

/** What each permission means to a person, for the "no access" panel. */
export const PERMISSION_TEXT: Record<Permission, string> = {
  build: "create and edit QR codes and set up modules",
  reviews: "reply to reviews and feedback",
  analytics: "view analytics",
  export: "download data",
  work: "manage leads, tickets and bookings",
  redeem: "redeem coupons and stamp loyalty cards",
  invite: "invite team members",
  settings: "change business settings",
  owner: "manage billing, API keys, data and the workspace",
};

export type Cell = "yes" | "no" | "view";
/** The matrix shown in Settings. The first seven rows are the design's; the last two add the modules built since. */
export const MATRIX_ROWS: { label: string; cells: Record<Role, Cell> }[] = (
  [
    { label: "Create and edit QR codes", p: "build" },
    { label: "Reply to reviews", p: "reviews" },
    { label: "View analytics", p: "analytics", viewOnlyWithout: "export" },
    { label: "Manage leads and tickets", p: "work" },
    { label: "Redeem coupons and stamp loyalty", p: "redeem" },
    { label: "Billing and plan", p: "owner" },
    { label: "Invite team members", p: "invite" },
    { label: "Business settings, files and data downloads", p: "settings" },
    { label: "API keys, webhooks and deleting the workspace", p: "owner" },
  ] as { label: string; p: Permission; viewOnlyWithout?: Permission }[]
).map((r) => ({
  label: r.label,
  cells: Object.fromEntries(ROLES.map((role) => [role, can(role, r.p) ? (r.viewOnlyWithout && !can(role, r.viewOnlyWithout) ? "view" : "yes") : "no"])) as Record<Role, Cell>,
}));

/** Who may invite or remove whom. An Owner manages everyone; a Manager manages Staff only. */
export const canManageMember = (actor: Role, target: MemberRole): boolean => actor === "owner" || (actor === "manager" && target === "staff");
/** Who may give which role. Only the Owner can make someone a Manager or change a role. */
export const canGrant = (actor: Role, role: MemberRole): boolean => canManageMember(actor, role);
