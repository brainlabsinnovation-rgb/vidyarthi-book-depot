"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductGrid } from "./product-grid";
import type { Product } from "@/data/catalog";
import type { ProductQuery, ProductResult } from "@/lib/catalog-api";

const PAGE_SIZE = 48;

export function CatalogPage({ title, description, items, total, query }: {
  title: string; description: string; items: Product[]; total?: number; query?: ProductQuery;
}) {
  const [offers, setOffers] = useState(false);
  const [inStock, setInStock] = useState(false);
  const [price, setPrice] = useState("all");
  const [rating, setRating] = useState(0);
  const [sort, setSort] = useState("popular");
  const [page, setPage] = useState(0);
  const [remote, setRemote] = useState<{ items: Product[]; total: number }>({ items, total: total ?? items.length });
  const [error, setError] = useState("");
  const queryKey = JSON.stringify(query ?? null);

  useEffect(() => {
    if (queryKey === "null") return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(JSON.parse(queryKey) as ProductQuery)) if (value !== undefined && value !== "") params.set(key, String(value));
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));
    params.set("sort", sort === "low" ? "price_asc" : sort === "high" ? "price_desc" : sort);
    if (offers) params.set("offersOnly", "true");
    if (inStock) params.set("inStock", "true");
    if (rating) params.set("minRating", String(rating));
    if (price === "under250") params.set("maxPrice", "249.99");
    if (price === "250to500") { params.set("minPrice", "250"); params.set("maxPrice", "500"); }
    if (price === "over500") params.set("minPrice", "500.01");
    fetch(`/api/store/catalog/products?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Catalog unavailable");
        return response.json() as Promise<ProductResult>;
      })
      .then((result) => { setRemote({ items: result.items, total: result.total }); setError(""); })
      .catch((reason) => { if (reason?.name !== "AbortError") setError("Products could not be loaded. Please try again."); })
    return () => controller.abort();
  }, [queryKey, page, sort, offers, inStock, rating, price]);

  const localItems = useMemo(() => {
    if (query) return items;
    return [...items.filter((product) =>
      (!offers || Boolean(product.badge)) &&
      (price === "all" || (price === "under250" && product.price < 250) ||
        (price === "250to500" && product.price >= 250 && product.price <= 500) ||
        (price === "over500" && product.price > 500)) && product.rating >= rating)]
      .sort((a, b) => sort === "low" ? a.price - b.price : sort === "high" ? b.price - a.price : sort === "new" ? b.slug.localeCompare(a.slug) : b.reviews - a.reviews);
  }, [items, query, offers, price, rating, sort]);
  const visible = query ? remote.items : localItems;
  const count = query ? remote.total : visible.length;
  const pageCount = Math.ceil(count / PAGE_SIZE);
  const resetPage = () => setPage(0);
  const clearFilters = () => { setOffers(false); setInStock(false); setPrice("all"); setRating(0); resetPage(); };

  return <>
    <section className="page-hero"><div className="shell"><div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><span>{title}</span></div><h1>{title}</h1><p>{description}</p></div></section>
    <section className="section"><div className="shell catalog-layout">
      <aside className="filters">
        <div className="filter-block"><h3>Availability</h3><label><input type="checkbox" checked={inStock} onChange={(event) => { setInStock(event.target.checked); resetPage(); }} /> In stock</label><label><input type="checkbox" checked={offers} onChange={(event) => { setOffers(event.target.checked); resetPage(); }} /> Special offers</label></div>
        <div className="filter-block"><h3>Price</h3>{[["all", "All prices"], ["under250", "Under ₹250"], ["250to500", "₹250–₹500"], ["over500", "Above ₹500"]].map(([value, label]) => <label key={value}><input type="radio" name="price" checked={price === value} onChange={() => { setPrice(value); resetPage(); }} /> {label}</label>)}</div>
        <div className="filter-block"><h3>Customer rating</h3><label><input type="radio" name="rating" checked={rating === 4} onChange={() => { setRating(4); resetPage(); }} /> 4 stars and above</label><label><input type="radio" name="rating" checked={rating === 0} onChange={() => { setRating(0); resetPage(); }} /> Any rating</label></div>
        <button className="clear-filters" onClick={clearFilters}>Clear filters</button>
      </aside>
      <div>
        <div className="catalog-top"><span>{count} products</span><select aria-label="Sort products" value={sort} onChange={(event) => { setSort(event.target.value); resetPage(); }}><option value="popular">Sort: Popularity</option><option value="low">Price: Low to high</option><option value="high">Price: High to low</option><option value="new">Newest first</option></select></div>
        {error ? <div className="empty-state small-empty"><h2>Products are unavailable.</h2><p>{error}</p><button className="button primary" onClick={() => window.location.reload()}>Try again</button></div> : visible.length ? <ProductGrid products={visible} /> : <div className="empty-state small-empty"><h2>No products match these filters.</h2><p>Clear the filters to see the complete collection.</p><button className="button primary" onClick={clearFilters}>Clear filters</button></div>}
        {query && pageCount > 1 && <div className="catalog-pagination"><button className="button secondary" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page + 1} of {pageCount}</span><button className="button secondary" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>Next</button></div>}
      </div>
    </div></section>
  </>;
}
