import Link from "next/link";
import { ProductGrid } from "@/components/product-grid";
import { products } from "@/data/catalog";
export default function BestSellers(){return <><section className="page-hero"><div className="shell"><div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><span>Best sellers</span></div><h1>Customer favourites</h1><p>Popular products selected from the static sample catalog.</p></div></section><section className="section"><div className="shell"><ProductGrid products={[...products].sort((a,b)=>b.reviews-a.reviews)}/></div></section></>}
