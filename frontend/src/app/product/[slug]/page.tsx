import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { products } from "@/data/catalog";
export function generateStaticParams() { return products.map(({ slug }) => ({ slug })); }
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const product = products.find((item) => item.slug === slug); if (!product) notFound(); return <ProductDetail product={product} />; }
