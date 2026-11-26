"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table, TableBody, TableHead, TableRow, Td, Th } from "@/components/ui/Table";
import { Toggle } from "@/components/ui/Toggle";
import type { ProductRecord } from "@/lib/products";

const label = "text-[11px] font-medium uppercase tracking-[0.05em] text-graphite";
const control = "min-h-10 text-sm";

function ProductForm({ product, onDone }: { product: ProductRecord | null; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({
    name: product?.name ?? "",
    model: product?.model ?? "",
    madeIn: product?.madeIn ?? "",
    warrantyMonths: String(product?.warrantyMonths ?? 12),
    manualUrl: product?.manualUrl ?? "",
    videosUrl: product?.videosUrl ?? "",
    buyUrl: product?.buyUrl ?? "",
    serviceEnabled: product?.serviceEnabled ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: Exclude<keyof typeof v, "serviceEnabled">) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await fetch(product ? `/api/products/${product.id}` : "/api/products", { method: product ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (res?.ok) {
      router.refresh();
      onDone();
    } else if (res?.status === 422) {
      setErrors(j.fields ?? {});
      setMsg("Please fix the highlighted fields.");
    } else setMsg("We couldn't save that. Please try again.");
  }

  return (
    <form onSubmit={save} noValidate aria-label={product ? "Edit product" : "Add product"} className="flex flex-col gap-3.5 p-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
        <Input label="Product name" value={v.name} onChange={set("name")} error={errors.name} placeholder="AquaPure RO 8L" labelClassName={label} className={control} />
        <Input label="Model" value={v.model} onChange={set("model")} placeholder="RO 8L" labelClassName={label} className={control} />
        <Input label="Made in" value={v.madeIn} onChange={set("madeIn")} placeholder="Chennai" labelClassName={label} className={control} />
        <Input label="Warranty (months)" inputMode="numeric" value={v.warrantyMonths} onChange={set("warrantyMonths")} error={errors.warrantyMonths} hint="0 turns warranty registration off." labelClassName={label} className={control} />
        <Input label="User manual link (PDF)" value={v.manualUrl} onChange={set("manualUrl")} error={errors.manualUrl} placeholder="https://" labelClassName={label} className={control} />
        <Input label="Setup videos link" value={v.videosUrl} onChange={set("videosUrl")} error={errors.videosUrl} placeholder="https://" labelClassName={label} className={control} />
        <Input label="Buy accessories link" value={v.buyUrl} onChange={set("buyUrl")} error={errors.buyUrl} placeholder="https://" labelClassName={label} className={control} />
      </div>
      <Toggle label="Buyers can book service from the product page" checked={v.serviceEnabled} onCheckedChange={(a) => setV((x) => ({ ...x, serviceEnabled: a }))} />
      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : product ? "Save product" : "Add product"}
        </Button>
        <Button onClick={onDone}>Cancel</Button>
        {msg ? (
          <p role="alert" className="m-0 text-sm text-danger-fg">
            {msg}
          </p>
        ) : null}
      </div>
    </form>
  );
}

/** The products whose codes you generate: name, warranty length, and the links on the buyer's page. */
export function ProductManager({ products, startOpen }: { products: ProductRecord[]; startOpen: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(startOpen ? "new" : null);
  const [msg, setMsg] = useState("");
  async function retire(p: ProductRecord) {
    if (!window.confirm(`Hide “${p.name}”? Codes already printed keep working.`)) return;
    const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setMsg("Couldn't hide that product.");
  }
  const editingProduct = editing && editing !== "new" ? (products.find((p) => p.id === editing) ?? null) : null;
  return (
    <section aria-labelledby="prod-h" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="prod-h" className="m-0 font-sans text-[17px] font-semibold">
          Products
        </h2>
        <Button size="sm" variant="primary" onClick={() => setEditing("new")}>
          + Add product
        </Button>
      </div>
      {msg ? (
        <p role="alert" className="m-0 text-sm text-danger-fg">
          {msg}
        </p>
      ) : null}
      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingProduct ? `Edit: ${editingProduct.name}` : "New product"}</CardTitle>
          </CardHeader>
          <ProductForm key={editing} product={editingProduct} onDone={() => setEditing(null)} />
        </Card>
      ) : null}
      <Card>
        <Table caption="Products">
          <TableHead>
            <TableRow>
              <Th>Product</Th>
              <Th>Warranty</Th>
              <Th>Batches</Th>
              <Th>Codes</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <Td colSpan={5} className="text-muted">
                  No products yet. Add one, then generate its serial codes.
                </Td>
              </TableRow>
            ) : (
              products.map((p) => (
                <TableRow key={p.id}>
                  <Td>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-[11px] text-muted">{[p.model, p.madeIn].filter(Boolean).join(" · ")}</div>
                  </Td>
                  <Td className="tabular">{p.warrantyMonths ? `${p.warrantyMonths} months` : "Off"}</Td>
                  <Td className="tabular">{p.batches}</Td>
                  <Td className="tabular">{p.codes.toLocaleString("en-IN")}</Td>
                  <Td>
                    <div className="flex gap-1.5">
                      <Button size="sm" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p.id)}>
                        Edit
                      </Button>
                      <Button size="sm" aria-label={`Hide ${p.name}`} onClick={() => retire(p)}>
                        Hide
                      </Button>
                    </div>
                  </Td>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </section>
  );
}
