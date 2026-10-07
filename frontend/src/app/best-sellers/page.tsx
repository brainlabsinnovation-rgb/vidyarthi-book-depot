import Link from "next/link";
import { ProductGrid } from "@/components/product-grid";
import { getProducts } from "@/lib/catalog-api";
export default async function BestSellers(){const result=await getProducts({sort:"popular",limit:48});return <><section className="page-hero"><div className="shell"><div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><span>Best sellers</span></div><h1>Customer favourites</h1><p>Popular products from our catalog.</p></div></section><section className="section"><div className="shell"><ProductGrid products={result.items}/></div></section></>}
