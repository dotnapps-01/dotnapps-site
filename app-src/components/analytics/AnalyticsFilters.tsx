"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { rangeOptions } from "@/lib/analytics-range";

/** QR / location / date-range selects. Choices live in the URL so a view can be shared and exported. */
export function AnalyticsFilters({
  qrCodes,
  locations,
  qr,
  location,
  range,
}: {
  qrCodes: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  qr: string;
  location: string;
  range: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${path}?${next.toString()}`);
  };
  const cls = "min-h-10 text-sm";
  return (
    <>
      <Select label="QR code" hideLabel value={qr} onChange={(e) => set("qr", e.target.value)} wrapperClassName="w-auto" className={cls}>
        <option value="">All QR codes</option>
        {qrCodes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select label="Location" hideLabel value={location} onChange={(e) => set("location", e.target.value)} wrapperClassName="w-auto" className={cls}>
        <option value="">All locations</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </Select>
      <Select label="Date range" hideLabel value={range} onChange={(e) => set("range", e.target.value)} wrapperClassName="w-auto" className={cls}>
        {rangeOptions.map((r) => (
          <option key={r.key} value={r.key}>
            {r.label}
          </option>
        ))}
      </Select>
    </>
  );
}
