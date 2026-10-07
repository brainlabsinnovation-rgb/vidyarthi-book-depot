"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { ProductGrid } from "@/components/product-grid";
import { useShop } from "@/components/shop-provider";
import type { Product } from "@/data/catalog";

export default function WishlistPage() {
  const { wishlist } = useShop();
  const [items, setItems] = useState<Product[]>([]);
  const [error, setError] = useState(false);
  const slugs = wishlist.join("|");
  useEffect(() => {
    if (!slugs) return;
    const controller = new AbortController();
    Promise.all(slugs.split("|").map(async (slug) => {
      const response = await fetch(`/api/store/catalog/products/${encodeURIComponent(slug)}`, { signal: controller.signal });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Catalog unavailable");
      return response.json() as Promise<Product>;
    })).then((products) => { setItems(products.filter((product): product is Product => product !== null)); setError(false); })
      .catch((reason) => { if (reason?.name !== "AbortError") setError(true); });
    return () => controller.abort();
  }, [slugs]);

  return <><section className="page-hero"><div className="shell"><div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><span>Wishlist</span></div><h1>Your wishlist</h1><p>Keep thoughtful finds close until you are ready to order.</p></div></section><section className="section"><div className="shell">{error ? <div className="empty-state"><Heart /><h2>Wishlist could not be loaded.</h2><p>Please try again shortly.</p></div> : items.length ? <ProductGrid products={items} /> : <div className="empty-state"><Heart /><h2>No saved products yet.</h2><p>Tap the heart on a product to keep it in your wishlist.</p><Link className="button primary" href="/shop">Explore products</Link></div>}</div></section></>;
}
