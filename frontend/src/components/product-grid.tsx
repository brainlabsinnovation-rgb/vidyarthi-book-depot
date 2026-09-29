import type { Product } from "@/data/catalog";
import { ProductCard } from "./product-card";
export function ProductGrid({ products, className = "" }: { products: Product[]; className?: string }) { return <div className={`product-grid ${className}`}>{products.map((product, index) => <ProductCard product={product} eager={index < 4} key={product.slug} />)}</div>; }
