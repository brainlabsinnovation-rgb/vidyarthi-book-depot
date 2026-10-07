"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, MapPin, Package, ShoppingBag } from "lucide-react";
import { AccountShell } from "@/components/account-shell";
import { useCustomerAuth } from "@/components/customer-auth-provider";
import { useShop } from "@/components/shop-provider";
type Summary = { orders: number; activeOrders: number; addresses: number };
export default function Dashboard() {
  const { user, status } = useCustomerAuth(); const { wishlist } = useShop();
  const [summary, setSummary] = useState<Summary | null>(null); const [error, setError] = useState("");
  useEffect(() => {
    if (status !== "signed-in") return;
    const controller = new AbortController();
    fetch("/api/store/customer/summary", { signal: controller.signal, credentials: "include" }).then((r) => r.ok ? r.json() : Promise.reject())
      .then(setSummary).catch(() => { if (!controller.signal.aborted) setError("Your account overview could not be loaded."); });
    return () => controller.abort();
  }, [status, user?.id]);
  return <AccountShell title="Account overview" intro="Your account, saved products and orders."><div className="account-stats"><article><ShoppingBag/><span><strong>{summary?.orders ?? "—"}</strong><small>Total orders</small></span></article><article><Package/><span><strong>{summary?.activeOrders ?? "—"}</strong><small>Active orders</small></span></article><article><Heart/><span><strong>{wishlist.length}</strong><small>Saved in this browser</small></span></article><article><MapPin/><span><strong>{summary?.addresses ?? "—"}</strong><small>Saved addresses</small></span></article></div>{error && <p role="alert">{error}</p>}<section className="account-panel"><h2>Welcome, {user?.name.split(" ")[0]}</h2><p>Your account is verified. Your purchases will appear here once orders are available.</p><Link className="button primary" href="/shop">Continue shopping</Link></section><section className="account-panel"><h2>Useful shortcuts</h2><div className="shortcut-grid"><Link href="/cart">Return to your cart</Link><Link href="/orders">View your orders</Link><Link href="/account/profile">Manage your profile</Link><Link href="/contact">Contact the store</Link></div></section></AccountShell>;
}
