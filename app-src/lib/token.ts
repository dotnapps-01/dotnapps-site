import "server-only";
import { randomBytes } from "node:crypto";

/** An unguessable link token for a customer's own page (ticket status, visitor pass, booking). 1 prefix letter + 22 URL-safe characters. */
export const newToken = (prefix: "t" | "v" | "b") => prefix + randomBytes(16).toString("base64url");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
/** A short code people can read out and type, e.g. BK-7K2QXM. */
export const shortCode = (prefix: string, len = 6) => {
  const b = randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return `${prefix}-${s}`;
};
