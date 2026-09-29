"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BookOpen, ChevronDown, Heart, HelpCircle, MapPin, Menu, PencilRuler, Search, ShoppingCart, Store, Truck, UserRound, X } from "lucide-react";
import { Brand } from "./brand";
import { useShop } from "./shop-provider";
import { bookSubcategories, stationerySubcategories } from "@/data/catalog";

export function SiteHeader() {
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(""); const router = useRouter(); const pathname = usePathname(); const { cartCount, wishlist } = useShop();
  function submitSearch(event: FormEvent) { event.preventDefault(); router.push(`/search?q=${encodeURIComponent(query.trim())}`); }
  return <>
    <div className="announcement"><div className="shell announcement-inner"><span><Truck /> Free pickup available</span><span>•</span><span>Secure payments</span><div className="announcement-links"><Link href="/contact"><Store /> Our Store</Link><Link href="/track-order">Track Order</Link><Link href="/contact"><HelpCircle /> Help & Support</Link></div></div></div>
    <header className="site-header"><div className="shell header-main"><button className="icon-btn mobile-menu" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button><Brand /><form className="header-search" onSubmit={submitSearch}><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search 3,000+ products" aria-label="Search products" /><button type="submit" aria-label="Submit search"><Search size={20} /></button></form><div className="header-actions"><Link href="/account" aria-label="Account"><UserRound /><span>Account<small>Sign in</small></span></Link><Link href="/wishlist" className="count-link" aria-label="Wishlist"><Heart /><span>Wishlist</span><b>{wishlist.length}</b></Link><Link href="/cart" className="count-link" aria-label="Cart"><ShoppingCart /><span>Cart</span><b>{cartCount}</b></Link></div></div>
      <div className="shell mobile-search-wrap"><form className="header-search" onSubmit={submitSearch}><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search 3,000+ products" aria-label="Search products" /></form></div>
      <nav className="category-nav" aria-label="Main navigation"><div className="shell nav-inner department-nav">
        <div className="department-nav-item"><Link className={pathname.startsWith("/books") ? "active" : ""} href="/books"><BookOpen /> Books <ChevronDown /></Link><div className="mega-menu"><div><span className="mega-icon books"><BookOpen /></span><strong>Books</strong><p>Learning, preparation and reading for every age.</p><Link href="/books">Explore all books <ChevronDown /></Link></div><div className="mega-links">{bookSubcategories.map(category=><Link href={`/books/${category.slug}`} key={category.slug}><span>{category.name}</span><small>{category.short}</small></Link>)}</div></div></div>
        <div className="department-nav-item"><Link className={pathname.startsWith("/stationery") ? "active" : ""} href="/stationery"><PencilRuler /> Stationery <ChevronDown /></Link><div className="mega-menu"><div><span className="mega-icon stationery"><PencilRuler /></span><strong>Stationery</strong><p>Everything for school, creativity, work and gifting.</p><Link href="/stationery">Explore all stationery <ChevronDown /></Link></div><div className="mega-links">{stationerySubcategories.map(category=><Link href={`/stationery/${category.slug}`} key={category.slug}><span>{category.name}</span><small>{category.short}</small></Link>)}</div></div></div>
        <Link href="/new-arrivals">New Arrivals</Link><Link href="/offers">Offers</Link><Link href="/school-lists">School Lists</Link><Link href="/bulk-orders">Bulk Orders</Link><span className="nav-message">Good tools <i>Brighter tomorrows</i> ♥</span>
      </div></nav>
    </header>
    {open && <div className="drawer-backdrop" onClick={() => setOpen(false)} />}
    <aside className={`mobile-drawer ${open ? "open" : ""}`} aria-hidden={!open}><div className="drawer-head"><Brand compact /><button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close menu"><X /></button></div><nav><Link onClick={() => setOpen(false)} href="/">Home</Link><strong>Books</strong><Link onClick={() => setOpen(false)} href="/books">All Books</Link>{bookSubcategories.map(category => <Link onClick={() => setOpen(false)} href={`/books/${category.slug}`} key={category.slug}>{category.name}</Link>)}<strong>Stationery</strong><Link onClick={() => setOpen(false)} href="/stationery">All Stationery</Link>{stationerySubcategories.map(category => <Link onClick={() => setOpen(false)} href={`/stationery/${category.slug}`} key={category.slug}>{category.name}</Link>)}</nav><div className="drawer-help"><Link href="/contact"><HelpCircle /> Help and support</Link><Link href="/track-order"><MapPin /> Track your order</Link></div></aside>
  </>;
}
