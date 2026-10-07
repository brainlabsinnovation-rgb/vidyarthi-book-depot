"use client";

import { useEffect, useState } from "react";
import { Download, IndianRupee, Package, ShoppingBag, Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { formatPrice } from "@/data/catalog";

type Reports = { orders: number; salesPaise: number; customers: number; averageOrderPaise: number;
  monthlySales: Array<{ month: string; salesPaise: number }>;
  categories: Array<{ name: string; salesPaise: number }> };

export default function ReportsPage() {
  const [report, setReport] = useState<Reports | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/store/admin/reports", { signal: controller.signal, credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Reports could not be loaded")))
      .then((data) => setReport(data))
      .catch((reason) => { if (reason?.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, []);
  function exportCsv() {
    if (!report) return;
    const lines = ["Metric,Value", `Net sales,${report.salesPaise / 100}`, `Paid orders,${report.orders}`, `Customers,${report.customers}`, `Average order,${report.averageOrderPaise / 100}`, "", "Month,Sales", ...report.monthlySales.map((item) => `${new Date(item.month).toISOString().slice(0, 7)},${item.salesPaise / 100}`)];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "vidyarthi-sales-report.csv"; link.click(); URL.revokeObjectURL(url);
  }
  const max = Math.max(1, ...(report?.monthlySales.map((item) => item.salesPaise) ?? []));
  const categoryTotal = report?.categories.reduce((sum, item) => sum + item.salesPaise, 0) ?? 0;
  return <AdminShell title="Reports" description={error || "Sales from captured payments and order records."} action={<button className="button primary" onClick={exportCsv} disabled={!report}><Download /> Export report</button>}><div className="admin-stats"><article><IndianRupee/><span>Net sales</span><strong>{report ? formatPrice(report.salesPaise / 100) : "—"}</strong><small>Captured payments</small></article><article><ShoppingBag/><span>Paid orders</span><strong>{report?.orders ?? "—"}</strong><small>All time</small></article><article><Package/><span>Average order</span><strong>{report ? formatPrice(report.averageOrderPaise / 100) : "—"}</strong><small>Paid orders</small></article><article><Users/><span>Customers</span><strong>{report?.customers ?? "—"}</strong><small>With paid orders</small></article></div><div className="admin-columns"><section className="admin-panel"><div className="panel-head"><h2>Sales by month</h2></div>{report?.monthlySales.length ? <div className="bar-chart">{report.monthlySales.map((item) => <i key={item.month} style={{ height: `${Math.max(4, item.salesPaise / max * 100)}%` }}><span>{new Date(item.month).toLocaleDateString("en-IN", { month: "short" })}</span></i>)}</div> : <p className="muted-copy">No paid orders yet.</p>}</section><section className="admin-panel"><div className="panel-head"><h2>Top categories</h2></div>{report?.categories.length ? <div className="metric-list">{report.categories.map((item) => <div key={item.name}><span>{item.name}</span><b>{categoryTotal ? Math.round(item.salesPaise / categoryTotal * 100) : 0}%</b><progress value={item.salesPaise} max={categoryTotal || 1}/></div>)}</div> : <p className="muted-copy">Category sales will appear after paid orders.</p>}</section></div></AdminShell>;
}
