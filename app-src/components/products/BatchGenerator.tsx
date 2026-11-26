"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { BATCH_FORMATS, MAX_BATCH } from "@/lib/product-input";

const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";

/** Generate serialized codes for a product. Numbering continues after the last serial used with the same prefix. */
export function BatchGenerator({ products }: { products: { id: string; name: string; warrantyMonths: number }[] }) {
  const router = useRouter();
  const [v, setV] = useState({ productId: products[0]?.id ?? "", quantity: "1000", prefix: "", warrantyMonths: "", format: "csv" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const chosen = products.find((p) => p.id === v.productId);
  const qty = Number(v.quantity.replace(/,/g, ""));

  async function generate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMsg(null);
    const res = await fetch("/api/products/batches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.ok) {
      setMsg({ tone: "ok", text: `${j.label} created: ${j.firstSerial} to ${j.lastSerial}. Download it below.` });
      router.refresh();
    } else if (res?.status === 422) setErrors(j.fields ?? {});
    else setMsg({ tone: "error", text: "We couldn't generate that batch. Please try again." });
  }

  return (
    <Card id="generate" className="flex-[1_1_320px]">
      <CardHeader>
        <CardTitle>Generate batch</CardTitle>
      </CardHeader>
      {products.length === 0 ? (
        <p className="m-0 p-[18px] text-sm text-graphite">Add a product first.</p>
      ) : (
        <form onSubmit={generate} noValidate aria-label="Generate batch" className="flex flex-col gap-3 p-[18px]">
          <Select label="Product" value={v.productId} onChange={set("productId")} error={errors.productId} labelClassName={label} className="min-h-10 text-sm">
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Input label="Quantity" inputMode="numeric" value={v.quantity} onChange={set("quantity")} error={errors.quantity} hint={`Up to ${MAX_BATCH.toLocaleString("en-IN")} in one batch.`} labelClassName={label} className="min-h-10 text-sm" />
          <Input label="Serial prefix" value={v.prefix} onChange={(e) => setV((x) => ({ ...x, prefix: e.target.value.toUpperCase() }))} error={errors.prefix} placeholder="AQ-26-" hint="Serials look like AQ-26-000001." labelClassName={label} className="min-h-10 text-sm" />
          <Input label={`Warranty (months, blank = ${chosen?.warrantyMonths ?? 12})`} inputMode="numeric" value={v.warrantyMonths} onChange={set("warrantyMonths")} error={errors.warrantyMonths} labelClassName={label} className="min-h-10 text-sm" />
          <Select label="Print format" value={v.format} onChange={set("format")} error={errors.format} labelClassName={label} className="min-h-10 text-sm">
            {BATCH_FORMATS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Generating…" : `Generate ${Number.isFinite(qty) && qty > 0 ? qty.toLocaleString("en-IN") : ""} codes`.replace("  ", " ")}
          </Button>
          {msg ? (
            <p role={msg.tone === "error" ? "alert" : "status"} className={msg.tone === "error" ? "m-0 text-sm text-danger-fg" : "m-0 text-sm text-success-fg"}>
              {msg.text}
            </p>
          ) : null}
        </form>
      )}
    </Card>
  );
}
