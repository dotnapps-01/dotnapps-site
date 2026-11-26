import "server-only";
import { audit } from "@/lib/audit";

/** Audit entry for something a customer's API key did. */
export const auditAsApi = (workspaceId: string, keyId: string, action: string, detail = "") => audit(workspaceId, `API key ${keyId.slice(0, 8)}`, action, detail);
