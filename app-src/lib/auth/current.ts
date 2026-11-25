import { ensureWorkspace, getWorkspace, type Workspace } from "@/lib/workspace";
import { getSession } from "./session";

/** The signed-in user's workspace, or null when logged out. Recreates the rows if the database was reset. */
export async function currentWorkspace(): Promise<Workspace | null> {
  const session = await getSession();
  if (!session) return null;
  return (await getWorkspace(session.sub)) ?? (await ensureWorkspace(session.sub));
}
