import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/catalog-page";
import { getCategories, getProducts } from "@/lib/catalog-api";
export default async function StationerySubcategoryPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const category=(await getCategories("stationery")).find(item=>item.slug===slug);if(!category)notFound();const query={department:"stationery" as const,category:slug};const result=await getProducts(query);return <CatalogPage title={category.name} description={category.short} items={result.items} total={result.total} query={query} />}
