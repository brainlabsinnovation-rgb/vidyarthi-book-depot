"use client";
import Link from "next/link";
import { Grid2X2, Home, Package, Search, ShoppingCart } from "lucide-react";
import { usePathname } from "next/navigation";
import { useShop } from "./shop-provider";

export function MobileNav() { const pathname = usePathname(); const { cartCount } = useShop(); const items = [{ href: "/", label: "Home", icon: Home }, { href: "/shop", label: "Categories", icon: Grid2X2 }, { href: "/search", label: "Search", icon: Search }, { href: "/orders", label: "Orders", icon: Package }, { href: "/cart", label: "Cart", icon: ShoppingCart }]; return <nav className="mobile-bottom-nav">{items.map(({ href, label, icon: Icon }) => <Link className={pathname === href ? "active" : ""} href={href} key={href}><span className="mobile-nav-icon"><Icon />{label === "Cart" && cartCount > 0 && <b>{cartCount}</b>}</span><small>{label}</small></Link>)}</nav>; }
