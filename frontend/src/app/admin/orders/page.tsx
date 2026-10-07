"use client";

import { useEffect, useState } from "react";
import { AdminTablePage } from "@/components/admin-table-page";
import { formatPrice } from "@/data/catalog";

type Order = { id: string; number: string; customer: string; fulfilment: string; itemCount: number; totalPaise: number; status: string; placedAt: string };

export default function AdminOrders() {
  const [items, setItems] = useState<Order[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/store/admin/orders", { signal: controller.signal, credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Orders could not be loaded")))
      .then((data) => setItems(data.items))
      .catch((reason) => { if (reason?.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, []);
  const rows = items.map((item) => [item.number, item.customer, item.fulfilment, String(item.itemCount), formatPrice(item.totalPaise / 100), item.status, new Date(item.placedAt).toLocaleString("en-IN")]);
  return <AdminTablePage title="Orders" description={error || "Review real orders and payment status. Checkout will begin creating orders after Razorpay is connected."} columns={["Order","Customer","Method","Items","Total","Status","Placed"]} rows={rows} rowHrefs={items.map((item) => `/admin/orders/${item.id}`)} />;
}
