import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { getProduct } from "@/lib/catalog-api";
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const product = await getProduct(slug); if (!product) notFound(); return <ProductDetail product={product} />; }
