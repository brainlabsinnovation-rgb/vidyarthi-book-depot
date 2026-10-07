"use client";

import { useEffect, useState } from "react";
import { AdminTablePage } from "@/components/admin-table-page";
import { formatPrice } from "@/data/catalog";

type Customer = { id: string; name: string; phone: string | null; orderCount: number; spentPaise: number; lastOrderAt: string | null };

export default function Customers() {
  const [items, setItems] = useState<Customer[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/store/admin/customers", { signal: controller.signal, credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Customers could not be loaded")))
      .then((data) => setItems(data.items))
      .catch((reason) => { if (reason?.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, []);
  const rows = items.map((item) => [item.name, item.phone ?? "—", String(item.orderCount), formatPrice(item.spentPaise / 100), item.lastOrderAt ? new Date(item.lastOrderAt).toLocaleDateString("en-IN") : "—", "Active"]);
  return <AdminTablePage title="Customers" description={error || "Review customers created through real orders."} columns={["Customer","Mobile","Orders","Spent","Last order","Status"]} rows={rows} rowHrefs={items.map((item) => `/admin/customers/${item.id}`)} />;
}
