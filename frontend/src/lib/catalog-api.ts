import type { CatalogCategory, DepartmentSlug, Product } from "@/data/catalog";

const backend = (process.env.BACKEND_URL || "http://127.0.0.1:4000").replace(/\/$/, "");

export type ProductQuery = {
  department?: DepartmentSlug;
  category?: string;
  q?: string;
  sort?: "popular" | "new" | "price_asc" | "price_desc" | "name";
  limit?: number;
  offset?: number;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  offersOnly?: boolean;
  inStock?: boolean;
};

export type ProductResult = { items: Product[]; total: number; limit: number; offset: number; source: "sample" | "database" };

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${backend}/api/catalog${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Catalog API request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export async function getDepartments() {
  return (await request<{ items: Array<{ slug: DepartmentSlug; name: string; short: string; image: string; color: string }> }>("/departments")).items;
}

export async function getCategories(department?: DepartmentSlug): Promise<CatalogCategory[]> {
  return (await request<{ items: CatalogCategory[] }>(`/categories${department ? `?department=${department}` : ""}`)).items;
}

export async function getProducts(query: ProductQuery = {}): Promise<ProductResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
  return request<ProductResult>(`/products?${params}`);
}

export async function getProduct(slug: string): Promise<Product | null> {
  const response = await fetch(`${backend}/api/catalog/products/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Catalog API request failed (${response.status})`);
  return response.json() as Promise<Product>;
}
