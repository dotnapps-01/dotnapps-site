import "server-only";
import { query } from "@/lib/db";

/** What each Operate QR code produced in a period, for the Actions column in Analytics. */
export async function opsActionsByQr(workspaceId: string, from: Date, to: Date): Promise<Map<string, { count: number; text: string }>> {
  const q = (table: string, col: string, extra = "") =>
    query<{ qr_id: string; n: number }>(`select qr_id, count(*)::int as n from ${table} where workspace_id = $1 and ${col} >= $2 and ${col} < $3 and qr_id is not null ${extra} group by 1`, [workspaceId, from, to]);
  const [tickets, checkins, visitors, bookings, enquiries] = await Promise.all([
    q("tickets", "created_at"),
    q("attendance", "in_at"),
    q("visitors", "created_at"),
    q("bookings", "created_at", "and status <> 'cancelled'"),
    q("plot_enquiries", "created_at"),
  ]);
  const out = new Map<string, { count: number; text: string }>();
  const add = (rows: { qr_id: string; n: number }[], one: string, many: string) => {
    for (const r of rows) out.set(r.qr_id, { count: r.n, text: `${r.n} ${r.n === 1 ? one : many}` });
  };
  add(tickets, "ticket", "tickets");
  add(checkins, "check-in", "check-ins");
  add(visitors, "visitor", "visitors");
  add(bookings, "booking", "bookings");
  add(enquiries, "enquiry", "enquiries");
  return out;
}
