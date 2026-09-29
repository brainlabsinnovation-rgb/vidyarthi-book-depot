import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/catalog-page";
import { bookSubcategories, products } from "@/data/catalog";
export function generateStaticParams(){return bookSubcategories.map(({slug})=>({slug}))}
export default async function BookSubcategoryPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const category=bookSubcategories.find(item=>item.slug===slug);if(!category)notFound();return <CatalogPage title={category.name} description={category.short} items={products.filter(product=>product.department==="books"&&product.subcategorySlug===slug)} />}
