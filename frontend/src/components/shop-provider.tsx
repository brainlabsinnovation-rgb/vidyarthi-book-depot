"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Product } from "@/data/catalog";

type CartLine = { product: Product; quantity: number };
type ShopContextValue = { cart: CartLine[]; wishlist: string[]; addToCart: (product: Product, quantity?: number) => void; removeFromCart: (slug: string) => void; updateQuantity: (slug: string, quantity: number) => void; toggleWishlist: (slug: string) => void; cartCount: number; cartMrpTotal: number; cartSavings: number; cartTotal: number };
const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { setCart(JSON.parse(localStorage.getItem("vbd-cart") || "[]")); setWishlist(JSON.parse(localStorage.getItem("vbd-wishlist") || "[]")); }
      catch { setCart([]); setWishlist([]); }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem("vbd-cart", JSON.stringify(cart)); }, [cart, ready]);
  useEffect(() => { if (ready) localStorage.setItem("vbd-wishlist", JSON.stringify(wishlist)); }, [wishlist, ready]);
  const value = useMemo<ShopContextValue>(() => {
    const totals = cart.reduce((summary, line) => {
      const unitMrp = Math.max(line.product.mrp, line.product.price);
      summary.cartCount += line.quantity;
      summary.cartMrpTotal += unitMrp * line.quantity;
      summary.cartTotal += line.product.price * line.quantity;
      return summary;
    }, { cartCount: 0, cartMrpTotal: 0, cartTotal: 0 });

    return {
      cart, wishlist,
      addToCart(product, quantity = 1) { setCart((lines) => { const existing = lines.find((line) => line.product.slug === product.slug); return existing ? lines.map((line) => line.product.slug === product.slug ? { ...line, quantity: line.quantity + quantity } : line) : [...lines, { product, quantity }]; }); },
      removeFromCart(slug) { setCart((lines) => lines.filter((line) => line.product.slug !== slug)); },
      updateQuantity(slug, quantity) { if (quantity >= 1) setCart((lines) => lines.map((line) => line.product.slug === slug ? { ...line, quantity } : line)); },
      toggleWishlist(slug) { setWishlist((items) => items.includes(slug) ? items.filter((item) => item !== slug) : [...items, slug]); },
      ...totals,
      cartSavings: totals.cartMrpTotal - totals.cartTotal,
    };
  }, [cart, wishlist]);
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() { const context = useContext(ShopContext); if (!context) throw new Error("useShop must be used within ShopProvider"); return context; }
