/** API key constants and types the screen shares with the server. Pure, so client components can import them. */
export const KEY_SCOPES = [
  { key: "read", label: "Read only", blurb: "Can look things up, never change them." },
  { key: "qr:write", label: "Create QR codes and batches", blurb: "Read, plus create QR codes and product batches." },
  { key: "all", label: "Everything", blurb: "All of the above, for the whole API." },
] as const;
export type KeyScope = (typeof KEY_SCOPES)[number]["key"];
export type KeyRecord = { id: string; name: string; scope: KeyScope; last4: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };
