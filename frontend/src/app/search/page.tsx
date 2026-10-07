import { CatalogPage } from "@/components/catalog-page";
import { getProducts } from "@/lib/catalog-api";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const params = await searchParams;
  const q = (Array.isArray(params.q) ? params.q[0] : params.q ?? "").trim();
  const query = q ? { q } : {};
  const result = await getProducts(query);
  return <CatalogPage title={q ? `Results for “${q}”` : "Search our store"} description={q ? `Search results for ${q}.` : "Find books, stationery, gifts and school essentials."} items={result.items} total={result.total} query={query} />;
}
