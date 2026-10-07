"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Boxes, ExternalLink, Grid3X3, Image, LayoutDashboard, LogOut, Megaphone, PackageCheck, Settings, ShoppingBag, Tags, Users } from "lucide-react";
const links = [{href:"/admin",label:"Dashboard",icon:LayoutDashboard},{href:"/admin/products",label:"Products",icon:Boxes},{href:"/admin/categories",label:"Categories",icon:Grid3X3},{href:"/admin/orders",label:"Orders",icon:ShoppingBag},{href:"/admin/inventory",label:"Inventory",icon:PackageCheck},{href:"/admin/offers",label:"Offers",icon:Tags},{href:"/admin/media",label:"Media",icon:Image},{href:"/admin/customers",label:"Customers",icon:Users},{href:"/admin/reports",label:"Reports",icon:BarChart3},{href:"/admin/homepage",label:"Homepage",icon:Megaphone},{href:"/admin/settings",label:"Settings",icon:Settings}];
export function AdminShell({ title, description, children, action }: { title: string; description: string; children: React.ReactNode; action?: React.ReactNode }) {
  const pathname=usePathname();
  const router=useRouter();
  const [access,setAccess]=useState<"checking"|"allowed"|"denied">("checking");
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/store/auth/get-session",{signal:controller.signal,credentials:"include"})
      .then(async response=>response.ok?response.json():null)
      .then(data=>{
        if(controller.signal.aborted)return;
        if(String(data?.user?.role??"").split(",").includes("admin"))setAccess("allowed");
        else {setAccess("denied");router.replace("/admin/login");}
      }).catch(()=>{if(!controller.signal.aborted)setAccess("denied");});
    return()=>controller.abort();
  },[router]);
  async function signOut(){await fetch("/api/store/auth/sign-out",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}",credentials:"include"});router.replace("/admin/login");router.refresh();}
  if(access!=="allowed")return <section className="admin-area"><div className="shell"><p>{access==="checking"?"Checking admin access…":"Admin access is required."}</p></div></section>;
  return <section className="admin-area"><div className="shell admin-shell"><aside className="admin-sidebar"><div><small>STORE ADMIN</small><strong>Management</strong></div><nav>{links.map(({href,label,icon:Icon}) => <Link className={pathname===href || (href!=="/admin" && pathname.startsWith(`${href}/`)) ? "active" : ""} href={href} key={href}><Icon /> {label}</Link>)}</nav><div className="admin-sidebar-foot"><Link href="/"><ExternalLink /> View store</Link><button type="button" onClick={signOut}><LogOut /> Sign out</button></div></aside><div className="admin-content"><div className="admin-title"><div><span className="kicker">Store administration</span><h1>{title}</h1><p>{description}</p></div>{action}</div>{children}</div></div></section>;
}
