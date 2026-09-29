"use client";
import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingCart, Star } from "lucide-react";
import { formatPrice, type Product } from "@/data/catalog";
import { useShop } from "./shop-provider";

export function ProductCard({ product, eager = false }: { product: Product; eager?: boolean }) {
  const { addToCart, toggleWishlist, wishlist } = useShop();
  const saved = wishlist.includes(product.slug);
  const discount = Math.round((1 - product.price / product.mrp) * 100);
  return <article className="product-card"><div className="product-media">{product.badge && <span className="product-badge">{product.badge}</span>}<button onClick={() => toggleWishlist(product.slug)} className={`wish-button ${saved ? "saved" : ""}`} aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}><Heart fill={saved ? "currentColor" : "none"} /></button><Link className="product-image-link" href={`/product/${product.slug}`}><Image src={product.image} alt={product.name} fill loading={eager ? "eager" : "lazy"} sizes="(max-width: 700px) 50vw, 25vw" /></Link></div><div className="product-info"><span className="product-category">{product.category}</span><Link href={`/product/${product.slug}`}><h3>{product.name}</h3></Link><p>{product.short}</p><div className="rating"><Star size={15} fill="currentColor" /> <strong>{product.rating}</strong><span>({product.reviews})</span></div><div className="price-row"><strong>{formatPrice(product.price)}</strong><del>{formatPrice(product.mrp)}</del><span>{discount}% off</span></div><button className="add-button" onClick={() => addToCart(product)}><ShoppingCart size={18} /> Add to cart</button></div></article>;
}
