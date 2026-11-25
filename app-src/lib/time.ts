/** "just now", "5 min ago", "3 h ago", "2 d ago". */
export function timeAgo(date: Date, now = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86_400)} d ago`;
}

/** Greeting for the current hour in India. */
export function greeting(now = new Date()): string {
  const h = new Date(now.getTime() + 5.5 * 3_600_000).getUTCHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
