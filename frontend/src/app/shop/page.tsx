import type { Metadata } from "next";
import { CatalogPage } from "@/components/catalog-page";
import { getProducts } from "@/lib/catalog-api";
export const metadata: Metadata = { title: "Shop all products" };
export default async function ShopPage() { const result = await getProducts(); return <CatalogPage title="All products" description="Browse books, stationery, school supplies, art materials, office essentials, gifts and return gifts." items={result.items} total={result.total} query={{}} />; }
