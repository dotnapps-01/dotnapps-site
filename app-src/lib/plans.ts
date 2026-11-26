import type { Plan } from "@/lib/workspace";

/** Plans from smallest to largest. */
export const PLAN_ORDER: Plan[] = ["free", "starter", "growth", "business", "enterprise"];
export const PLAN_LABEL: Record<Plan, string> = { free: "Free", starter: "Starter", growth: "Growth", business: "Business", enterprise: "Enterprise" };
export const isPlan = (v: unknown): v is Plan => typeof v === "string" && (PLAN_ORDER as string[]).includes(v);

/** The smallest plan that includes each platform feature (design: Product QR and API keys are Enterprise). */
export const FEATURE_PLAN = { products: "enterprise", api: "enterprise" } as const satisfies Record<string, Plan>;
export type Feature = keyof typeof FEATURE_PLAN;

export const planAtLeast = (plan: Plan, min: Plan) => PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(min);
export const canUse = (plan: Plan, feature: Feature) => planAtLeast(plan, FEATURE_PLAN[feature]);

/** File storage included with each plan, in MB (logos and PDFs). Adjust here when the pricing is confirmed. */
export const STORAGE_MB: Record<Plan, number> = { free: 20, starter: 100, growth: 500, business: 2000, enterprise: 10000 };
