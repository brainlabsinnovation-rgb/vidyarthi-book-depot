"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";

type Product = { slug: string; name: string; sku: string | null; stock: number };

export default function AdjustInventory() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/store/admin/products", { signal: controller.signal, credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Products could not be loaded")))
      .then((data) => setProducts(data.items))
      .catch((reason) => { if (reason?.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const productInput = String(form.get("product") ?? "").trim();
    const product = products.find((item) => item.slug === productInput || item.sku === productInput || item.name === productInput);
    if (!product) { setError("Choose a product from the list or enter its slug or SKU."); return; }
    const quantity = Number(form.get("quantity"));
    if (!Number.isInteger(quantity) || quantity < 0) { setError("Enter a valid whole number quantity."); return; }
    const type = String(form.get("type"));
    const delta = type === "Add stock" ? quantity : type === "Remove stock" ? -quantity : quantity - product.stock;
    if (delta === 0) { setError("This adjustment does not change the stock quantity."); return; }
    const reasonName = String(form.get("reason"));
    const reason = reasonName === "New stock received" ? "restock" : reasonName === "Damaged item" ? "damage" : reasonName === "Customer return" ? "return" : "correction";
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/store/admin/inventory/adjust", { method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productSlug: product.slug, delta, reason, note: String(form.get("notes") ?? "") }) });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error ?? "Adjustment failed"); }
      router.push("/admin/inventory"); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Adjustment failed"); }
    finally { setSaving(false); }
  }

  return <AdminShell title="Adjust stock" description="Record a stock change with an audit trail."><form className="admin-form-layout" onSubmit={submit}><div className="admin-form-main"><section className="admin-panel form-panel"><div className="panel-heading"><h2>Stock adjustment</h2><p>Inventory updates are saved in PostgreSQL.</p></div><div className="admin-form-grid"><label className="full"><span>Product slug or SKU</span><input name="product" list="inventory-products" required placeholder="Choose a product" /><datalist id="inventory-products">{products.map((product) => <option key={product.slug} value={product.slug}>{product.name}{product.sku ? ` · ${product.sku}` : ""}</option>)}</datalist></label><label><span>Adjustment</span><select name="type"><option>Add stock</option><option>Remove stock</option><option>Set exact quantity</option></select></label><label><span>Quantity</span><input name="quantity" type="number" min="0" step="1" required /></label><label><span>Reason</span><select name="reason"><option>New stock received</option><option>Damaged item</option><option>Stock count correction</option><option>Customer return</option></select></label><label className="full"><span>Notes</span><textarea name="notes" rows={4} /></label></div></section>{error && <p className="demo-note" role="alert">{error}</p>}</div><aside className="admin-save-card"><h3>Confirm adjustment</h3><p>Review the product, quantity and reason before saving.</p><button className="button primary" type="submit" disabled={saving}><Save /> {saving ? "Saving…" : "Save adjustment"}</button><Link className="button secondary" href="/admin/inventory">Cancel</Link></aside></form></AdminShell>;
}
