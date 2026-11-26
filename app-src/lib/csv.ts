/** One CSV cell. A value that starts like a spreadsheet formula is prefixed with ' so a customer's name can never run as one. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const csvRow = (cells: unknown[]) => cells.map(csvCell).join(",");
export const toCsv = (header: string[], rows: unknown[][]) => [csvRow(header), ...rows.map(csvRow)].join("\n") + "\n";
