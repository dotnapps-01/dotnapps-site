/**
 * Placeholder counters for the app shell until QR codes, reviews, leads and tickets exist (Phase 4+).
 * A new workspace starts on the Free plan (3 dynamic QR codes, see /pricing) with nothing waiting.
 */
import type { AppNavKey } from "@/lib/routes";

export const sidebarBadges: Partial<Record<AppNavKey, string>> = {};

export const plan = { name: "Free", used: 0, limit: 3, upgradeTo: "Starter" };
