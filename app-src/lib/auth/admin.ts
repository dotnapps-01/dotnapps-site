import "server-only";
import { adminPhones } from "./admin-phones";
import { getSession } from "./session";

export { adminPhones };

export type Actor = {
  /** whose workspace is shown */
  sub: string;
  /** the admin acting for them, while impersonating */
  act: string | null;
  /** the real person at the keyboard */
  real: string;
  /** may open the admin console */
  admin: boolean;
};

/** Who is really signed in. While an admin views a tenant, `real` stays the admin, so admin rights and audit entries follow the person, not the tenant. */
export async function currentActor(): Promise<Actor | null> {
  const s = await getSession(); // an impersonation whose admin is no longer listed is already dropped there
  if (!s) return null;
  const real = s.act ?? s.sub;
  return { sub: s.sub, act: s.act ?? null, real, admin: adminPhones().includes(real) };
}
