import { can, type Permission, type Role } from "./permissions";

/**
 * Screens with tabs: which tabs this role may open, which one to land on, and what to ask for when a forbidden one
 * is requested by address. (Pure, so the pages and the checks share it.)
 */
export function resolveTabs<T extends { key: string }>(tabs: readonly T[], need: Record<string, Permission>, role: Role, requested: string | undefined, fallback: string): { visible: T[]; tab: string; denied: Permission | null } {
  const visible = tabs.filter((t) => can(role, need[t.key]));
  if (visible.length === 0) return { visible, tab: fallback, denied: need[fallback] };
  const asked = tabs.find((t) => t.key === requested);
  if (asked) return can(role, need[asked.key]) ? { visible, tab: asked.key, denied: null } : { visible, tab: fallback, denied: need[asked.key] };
  return { visible, tab: visible.some((t) => t.key === fallback) ? fallback : visible[0].key, denied: null };
}
