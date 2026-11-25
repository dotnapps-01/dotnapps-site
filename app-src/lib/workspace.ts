import { cookies } from "next/headers";
import { signToken, verifyToken } from "./auth/crypto";
import { COOKIE } from "./auth/session";
import { goalOptions, industryOptions, type GoalKey, type IndustryKey } from "./content/onboarding";

/**
 * The business set up during onboarding.
 *
 * Stop-gap storage: a signed cookie, so the whole flow works with no database. It is per browser
 * and size-limited, which is fine for these few fields. Phase 4 introduces Postgres; replace
 * getWorkspace/saveWorkspace with queries and nothing else needs to change.
 */
export type Workspace = {
  sub: string;
  businessName: string;
  industry: IndustryKey | "";
  goals: GoalKey[];
  locationName: string;
  address: string;
  /** furthest wizard step reached: 0 verify … 4 live */
  step: number;
  onboarded: boolean;
  exp: number;
};

const YEAR = 365 * 86_400_000;

export const emptyWorkspace = (sub: string, businessName = ""): Workspace => ({
  sub,
  businessName,
  industry: "",
  goals: [],
  locationName: "",
  address: "",
  step: 1,
  onboarded: false,
  exp: Date.now() + YEAR,
});

export async function getWorkspace(sub: string): Promise<Workspace | null> {
  const jar = await cookies();
  const ws = await verifyToken<Workspace>(jar.get(COOKIE.workspace)?.value);
  return ws && ws.sub === sub ? ws : null;
}

export async function saveWorkspace(ws: Workspace) {
  const jar = await cookies();
  jar.set(COOKIE.workspace, await signToken({ ...ws, exp: Date.now() + YEAR }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: YEAR / 1000,
  });
}

const industryKeys = new Set<string>(industryOptions.map((i) => i.key));
const goalKeys = new Set<string>(goalOptions.map((g) => g.key));

/** Whitelists and trims untrusted onboarding input. */
export function sanitizeWorkspacePatch(input: Record<string, unknown>): Partial<Workspace> {
  const out: Partial<Workspace> = {};
  if (typeof input.industry === "string" && industryKeys.has(input.industry)) out.industry = input.industry as IndustryKey;
  if (Array.isArray(input.goals)) out.goals = [...new Set(input.goals.filter((g): g is GoalKey => typeof g === "string" && goalKeys.has(g)))];
  if (typeof input.locationName === "string") out.locationName = input.locationName.trim().slice(0, 120);
  if (typeof input.address === "string") out.address = input.address.trim().slice(0, 240);
  if (typeof input.step === "number" && Number.isInteger(input.step)) out.step = Math.min(4, Math.max(1, input.step));
  return out;
}
