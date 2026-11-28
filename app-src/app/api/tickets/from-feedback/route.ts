import { authedJson, notFound, ok } from "@/lib/api-auth";
import { ticketFromFeedback } from "@/lib/tickets";

export const dynamic = "force-dynamic";

/** Turns a private-feedback item from the Reviews inbox into a ticket. Safe to repeat: one ticket per item. */
export async function POST(req: Request) {
  const a = await authedJson(req, "work");
  if ("error" in a) return a.error;
  const r = await ticketFromFeedback(a.ws.id, String(a.body.feedbackId ?? ""));
  return r.ok ? ok({ seq: r.seq, created: r.created }, r.created ? 201 : 200) : notFound();
}
