"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Heart, LayoutDashboard, LogOut, MapPin, Package, UserRound } from "lucide-react";
import { useCustomerAuth } from "./customer-auth-provider";
import { RequireCustomer } from "./require-customer";
const links = [{href:"/account/dashboard",label:"Overview",icon:LayoutDashboard},{href:"/orders",label:"My orders",icon:Package},{href:"/wishlist",label:"Wishlist",icon:Heart},{href:"/account/addresses",label:"Addresses",icon:MapPin},{href:"/account/profile",label:"Profile",icon:UserRound}];
export function AccountShell({ title, intro, children, nextPath = "/account/dashboard" }: { title: string; intro: string; children: React.ReactNode; nextPath?: string }) {
  const { user, signOut } = useCustomerAuth(); const router = useRouter(); const [error, setError] = useState("");
  async function logout() { try { await signOut(); router.replace("/account"); router.refresh(); } catch { setError("Could not sign out. Please try again."); } }
  return <RequireCustomer nextPath={nextPath}><section className="page-hero compact-hero"><div className="shell"><div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><Link href="/account/dashboard">Account</Link><span>/</span><span>{title}</span></div><h1>{title}</h1><p>{intro}</p></div></section><section className="section account-section"><div className="shell customer-account"><aside><div className="account-person"><span>{user?.name.slice(0,2).toUpperCase()}</span><strong>{user?.name}</strong><small>{user?.emailVerified ? user.email : user?.phoneNumber}</small></div><nav>{links.map(({href,label,icon:Icon}) => <Link href={href} key={href}><Icon/>{label}</Link>)}<button className="account-signout" onClick={logout}><LogOut/> Sign out</button></nav>{error && <p role="alert">{error}</p>}</aside><div className="account-content">{children}</div></div></section></RequireCustomer>;
}
