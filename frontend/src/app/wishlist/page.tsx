"use client";
import Link from "next/link";
import { Heart } from "lucide-react";
import { ProductGrid } from "@/components/product-grid";
import { useShop } from "@/components/shop-provider";
import { products } from "@/data/catalog";
export default function WishlistPage() { const { wishlist } = useShop(); const items = products.filter((product) => wishlist.includes(product.slug)); return <><section className="page-hero"><div className="shell"><div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><span>Wishlist</span></div><h1>Your wishlist</h1><p>Keep thoughtful finds close until you are ready to order.</p></div></section><section className="section"><div className="shell">{items.length ? <ProductGrid products={items} /> : <div className="empty-state"><Heart /><h2>No saved products yet.</h2><p>Tap the heart on a product to keep it in your wishlist.</p><Link className="button primary" href="/shop">Explore products</Link></div>}</div></section></>; }
