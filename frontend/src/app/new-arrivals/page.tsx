import Link from "next/link";
import { ProductGrid } from "@/components/product-grid";
import { products } from "@/data/catalog";
export default function NewArrivals(){return <><section className="page-hero"><div className="shell"><div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><span>New arrivals</span></div><h1>New arrivals</h1><p>Fresh stationery, books, supplies and gift ideas added to the store.</p></div></section><section className="section"><div className="shell"><ProductGrid products={[...products].reverse()}/></div></section></>}
