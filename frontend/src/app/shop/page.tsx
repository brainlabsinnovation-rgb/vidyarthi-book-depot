import type { Metadata } from "next";
import { CatalogPage } from "@/components/catalog-page";
import { products } from "@/data/catalog";
export const metadata: Metadata = { title: "Shop all products" };
export default function ShopPage() { return <CatalogPage title="All products" description="Browse books, stationery, school supplies, art materials, office essentials, gifts and return gifts." items={products} />; }
