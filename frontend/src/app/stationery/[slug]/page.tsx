import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/catalog-page";
import { products, stationerySubcategories } from "@/data/catalog";
export function generateStaticParams(){return stationerySubcategories.map(({slug})=>({slug}))}
export default async function StationerySubcategoryPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const category=stationerySubcategories.find(item=>item.slug===slug);if(!category)notFound();return <CatalogPage title={category.name} description={category.short} items={products.filter(product=>product.department==="stationery"&&product.subcategorySlug===slug)} />}
