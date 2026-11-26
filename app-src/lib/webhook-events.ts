/** The events a webhook can subscribe to. Pure, so the screen and the server share one list. */
export const WEBHOOK_EVENTS = [
  { key: "scan.created", label: "A QR code was scanned" },
  { key: "lead.created", label: "A lead form was submitted" },
  { key: "review.received", label: "A customer rated you" },
  { key: "ticket.created", label: "A ticket was raised" },
  { key: "booking.created", label: "A booking or event ticket was made" },
  { key: "warranty.registered", label: "A warranty was registered" },
  { key: "counterfeit.flagged", label: "A product code looked suspicious" },
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]["key"];
export type EndpointView = { id: string; url: string; events: WebhookEvent[]; active: boolean; failures: number; lastStatus: number | null; lastAt: string | null };
export type DeliveryView = { id: number; event: string; status: number | null; ok: boolean; error: string; attempt: number; at: string };
