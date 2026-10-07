"use client";

import { useEffect, useState } from "react";
import { AdminTablePage } from "@/components/admin-table-page";

type Product = { name: string; sku: string | null; stock: number; reserved: number; lowStockThreshold: number };

export default function Inventory() {
  const [items, setItems] = useState<Product[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/store/admin/products", { signal: controller.signal, credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Inventory could not be loaded")))
      .then((data) => setItems(data.items))
      .catch((reason) => { if (reason?.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, []);
  const rows = items.map((item) => [item.name, item.sku ?? "—", String(item.stock - item.reserved), String(item.reserved), String(item.lowStockThreshold), item.stock - item.reserved <= item.lowStockThreshold ? "Low stock" : "Healthy"]);
  return <AdminTablePage title="Inventory" description={error || "Monitor live quantities and stock alerts."} button="Adjust stock" actionHref="/admin/inventory/adjust" columns={["Product","SKU","Available","Reserved","Low-stock level","Status"]} rows={rows} />;
}
