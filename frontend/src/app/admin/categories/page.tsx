"use client";

import { useEffect, useState } from "react";
import { AdminTablePage } from "@/components/admin-table-page";

type AdminCategory = { slug: string; name: string; departmentName: string; productCount: number; showInNavigation: boolean; active: boolean; updatedAt: string };

export default function Categories() {
  const [items, setItems] = useState<AdminCategory[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/store/admin/categories", { signal: controller.signal, credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Categories could not be loaded")))
      .then((data) => setItems(data.items))
      .catch((reason) => { if (reason?.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, []);
  const rows = items.map((item) => [item.name, item.departmentName, String(item.productCount), item.showInNavigation ? "Visible" : "Hidden", item.active ? "Published" : "Draft", new Date(item.updatedAt).toLocaleDateString("en-IN")]);
  return <AdminTablePage title="Categories" description={error || "Manage Books and Stationery subcategories. Changes save to PostgreSQL."} button="Add subcategory" actionHref="/admin/categories/new" columns={["Subcategory","Department","Products","Navigation","Status","Updated"]} rows={rows} rowHrefs={items.map((item) => `/admin/categories/${item.slug}/edit`)} />;
}
