"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountShell } from "@/components/account-shell";
import { useCustomerAuth } from "@/components/customer-auth-provider";
import { formatPrice } from "@/data/catalog";
type Order = { number: string; status: string; totalPaise: number; placedAt: string };
export default function OrdersPage() {
  const { user,status }=useCustomerAuth(); const [orders,setOrders]=useState<Order[]|null>(null); const [error,setError]=useState("");
  useEffect(() => {
    if(status!=="signed-in")return;
    const controller=new AbortController();
    fetch("/api/store/customer/orders",{signal:controller.signal,credentials:"include"}).then((r)=>r.ok?r.json():Promise.reject()).then((data)=>setOrders(data.items))
      .catch(()=>{if(!controller.signal.aborted)setError("Your orders could not be loaded.");});
    return()=>controller.abort();
  },[status,user?.id]);
  return <AccountShell title="Your orders" intro="Only orders placed with your account appear here." nextPath="/orders">{error?<p role="alert">{error}</p>:orders?.length?orders.map((order)=><article className="account-panel" key={order.number}><h2>{order.number}</h2><p>{order.status.replaceAll("_"," ")} · {formatPrice(order.totalPaise/100)}</p><Link href={`/orders/${encodeURIComponent(order.number)}`}>View order</Link></article>):<section className="account-panel"><h2>{orders?"No orders yet":"Loading your orders…"}</h2><p>Your purchases will appear here after orders are available.</p><Link className="button primary" href="/shop">Browse products</Link></section>}</AccountShell>;
}
