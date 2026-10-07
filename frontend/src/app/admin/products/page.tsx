"use client";

import { useEffect, useState } from "react";
import { AdminTablePage } from "@/components/admin-table-page";
import { formatPrice } from "@/data/catalog";

type AdminProduct = { slug: string; name: string; sku: string | null; categoryName: string; price: number; stock: number; status: string; updatedAt: string };

export default function AdminProducts() {
  const [items, setItems] = useState<AdminProduct[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/store/admin/products", { signal: controller.signal, credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Products could not be loaded")))
      .then((data) => setItems(data.items))
      .catch((reason) => { if (reason?.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, []);
  const rows = items.map((item) => [item.name, item.sku ?? "—", item.categoryName, formatPrice(item.price), String(item.stock), item.status === "active" ? "Published" : item.status === "archived" ? "Archived" : "Draft", new Date(item.updatedAt).toLocaleDateString("en-IN")]);
  return <AdminTablePage title="Products" description={error || "Manage products, prices, inventory and visibility. Changes save to PostgreSQL."} button="Add product" actionHref="/admin/products/new" columns={["Product","SKU","Category","Price","Stock","Status","Updated"]} rows={rows} rowHrefs={items.map((item) => `/admin/products/${item.slug}/edit`)} />;
}
