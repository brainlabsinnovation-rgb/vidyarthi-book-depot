import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/catalog-page";
import { categories, products } from "@/data/catalog";
export function generateStaticParams() { return categories.map(({ slug }) => ({ slug })); }
export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const category = categories.find((item) => item.slug === slug); if (!category) notFound(); const items = products.filter((product) => product.categorySlug === slug); return <CatalogPage title={category.name} description={category.short} items={items.length ? items : products.slice(0,4)} />; }
