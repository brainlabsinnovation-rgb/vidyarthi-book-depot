"use client";

import { useEffect, useState } from "react";
import { AdminTablePage } from "@/components/admin-table-page";
import { formatPrice } from "@/data/catalog";

type Offer = { id: string; name: string; code: string | null; discountType: "percentage" | "fixed"; discountValue: number; startsAt: string; endsAt: string; active: boolean; uses: number; productSlugs: string[]; categorySlugs: string[] };

export default function AdminOffers() {
  const [items, setItems] = useState<Offer[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/store/admin/offers", { signal: controller.signal, credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Offers could not be loaded")))
      .then((data) => setItems(data.items))
      .catch((reason) => { if (reason?.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, []);
  const rows = items.map((item) => [
    item.code ? `${item.name} (${item.code})` : item.name,
    item.productSlugs.length ? `${item.productSlugs.length} products` : item.categorySlugs.length ? `${item.categorySlugs.length} categories` : "Entire store",
    item.discountType === "percentage" ? `${item.discountValue}%` : formatPrice(item.discountValue),
    new Date(item.startsAt).toLocaleDateString("en-IN"), new Date(item.endsAt).toLocaleDateString("en-IN"),
    item.active ? "Enabled" : "Disabled",
    String(item.uses),
  ]);
  return <AdminTablePage title="Offers" description={error || "Schedule product, category and occasion discounts."} button="Create offer" actionHref="/admin/offers/new" columns={["Offer","Applies to","Discount","Starts","Ends","Status","Usage"]} rows={rows} rowHrefs={items.map((item) => `/admin/offers/${item.id}/edit`)} />;
}
