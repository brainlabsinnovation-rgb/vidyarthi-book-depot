"use client";
import { useEffect,useState } from "react";
import { AccountShell } from "@/components/account-shell";
import { useCustomerAuth } from "@/components/customer-auth-provider";
type Address={label:string;recipient_name:string;line_1:string;line_2:string;city:string;state:string;postal_code:string;phone:string};
export default function Addresses(){
 const {user,status}=useCustomerAuth();const [items,setItems]=useState<Address[]|null>(null);const [error,setError]=useState("");
 useEffect(()=>{if(status!=="signed-in")return;const controller=new AbortController();fetch("/api/store/customer/addresses",{signal:controller.signal,credentials:"include"}).then(r=>r.ok?r.json():Promise.reject()).then(data=>setItems(data.items)).catch(()=>{if(!controller.signal.aborted)setError("Addresses could not be loaded.");});return()=>controller.abort();},[status,user?.id]);
 return <AccountShell title="Saved addresses" intro="Your delivery addresses." nextPath="/account/addresses">{error?<p role="alert">{error}</p>:items?.length?<div className="address-grid">{items.map((item,index)=><article className="account-panel" key={index}><h2>{item.label}</h2><p>{item.recipient_name}<br/>{item.line_1}<br/>{item.line_2}<br/>{item.city}, {item.state} {item.postal_code}<br/>{item.phone}</p></article>)}</div>:<section className="account-panel"><h2>{items?"No saved addresses yet":"Loading addresses…"}</h2><p>Address management will be available with order checkout.</p></section>}</AccountShell>;
}
