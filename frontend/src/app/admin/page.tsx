"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, IndianRupee, PackageCheck, ShoppingBag, Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { formatPrice } from "@/data/catalog";

type Summary = { ordersToday: number; revenueTodayPaise: number; productsInStock: number; customers: number;
  recentOrders: Array<{ number: string; customer: string; status: string; totalPaise: number }>;
  lowStock: Array<{ name: string; available: number }> };

export default function AdminPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/store/admin/summary", { signal: controller.signal, credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Dashboard could not be loaded")))
      .then((data) => setSummary(data))
      .catch((reason) => { if (reason?.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, []);
  const stats = [
    { label: "Orders today", value: String(summary?.ordersToday ?? "—"), note: "Placed today", icon: ShoppingBag },
    { label: "Today’s revenue", value: summary ? formatPrice(summary.revenueTodayPaise / 100) : "—", note: "Captured payments", icon: IndianRupee },
    { label: "Products in stock", value: String(summary?.productsInStock ?? "—"), note: "Available products", icon: PackageCheck },
    { label: "Customers", value: String(summary?.customers ?? "—"), note: "Saved customer profiles", icon: Users },
  ];
  return <AdminShell title="Store overview" description={error || "Live catalog and order activity from PostgreSQL."}><div className="admin-stats">{stats.map(({label,value,note,icon:Icon}) => <article key={label}><Icon /><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div><div className="admin-columns"><section className="admin-panel"><div className="panel-head"><h2>Recent orders</h2><Link href="/admin/orders">View all <ArrowUpRight /></Link></div><table><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th></tr></thead><tbody>{summary?.recentOrders.map((order) => <tr key={order.number}><td>{order.number}</td><td>{order.customer}</td><td><span className={`status ${order.status}`}>{order.status}</span></td><td>{formatPrice(order.totalPaise / 100)}</td></tr>)}</tbody></table>{summary && summary.recentOrders.length === 0 && <p className="muted-copy">No orders yet.</p>}</section><section className="admin-panel low-stock"><div className="panel-head"><h2>Stock attention</h2></div>{summary?.lowStock.map((item) => <div key={item.name}><AlertTriangle /><span><strong>{item.name}</strong><small>{item.available} available</small></span></div>)}{summary && summary.lowStock.length === 0 && <p className="muted-copy">No low-stock products.</p>}</section></div></AdminShell>;
}
