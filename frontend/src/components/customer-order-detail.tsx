"use client";
import { useEffect,useState } from "react";
import { AccountShell } from "./account-shell";
import { useCustomerAuth } from "./customer-auth-provider";
import { formatPrice } from "@/data/catalog";
type Order={number:string;status:string;fulfilment:string;totalPaise:number;items:Array<{name:string;quantity:number;totalPaise:number}>};
export function CustomerOrderDetail({number}:{number:string}){
 const {user,status}=useCustomerAuth();const [order,setOrder]=useState<Order|null>(null);const [error,setError]=useState("");
 useEffect(()=>{if(status!=="signed-in")return;const controller=new AbortController();fetch(`/api/store/customer/orders/${encodeURIComponent(number)}`,{signal:controller.signal,credentials:"include"}).then(async r=>{if(!r.ok)throw new Error(r.status===404?"Order not found.":"Could not load this order.");return r.json();}).then(setOrder).catch(reason=>{if(!controller.signal.aborted)setError(reason.message);});return()=>controller.abort();},[status,user?.id,number]);
 return <AccountShell title={`Order ${number}`} intro="Your order details." nextPath={`/orders/${number}`}>{error?<p role="alert">{error}</p>:order?<section className="account-panel"><h2>{order.status.replaceAll("_"," ")}</h2><p>{order.fulfilment} · {formatPrice(order.totalPaise/100)}</p>{order.items.map((item,index)=><div className="checkout-product-line" key={index}><span>{item.name} × {item.quantity}</span><strong>{formatPrice(item.totalPaise/100)}</strong></div>)}</section>:<p>Loading order…</p>}</AccountShell>;
}
