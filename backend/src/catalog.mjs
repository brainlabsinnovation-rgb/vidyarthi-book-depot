import { readFile } from "node:fs/promises";

const sampleCatalog = JSON.parse(await readFile(new URL("../database/seeds/sample-catalog.json", import.meta.url), "utf8"));
const allowedSorts = new Set(["popular", "new", "price_asc", "price_desc", "name"]);

export class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function parsePagination(searchParams) {
  const limit = Number(searchParams.get("limit") ?? 48);
  const offset = Number(searchParams.get("offset") ?? 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
    throw new RequestError(400, "limit must be 1–100 and offset must be zero or greater");
  }
  return { limit, offset };
}

function parseFilters(searchParams) {
  const minPrice = Number(searchParams.get("minPrice") ?? 0);
  const maxPrice = searchParams.has("maxPrice") ? Number(searchParams.get("maxPrice")) : null;
  const minRating = Number(searchParams.get("minRating") ?? 0);
  if (!Number.isFinite(minPrice) || minPrice < 0 || (maxPrice !== null && (!Number.isFinite(maxPrice) || maxPrice < minPrice)) || !Number.isFinite(minRating) || minRating < 0 || minRating > 5) {
    throw new RequestError(400, "Invalid price or rating filter");
  }
  return { minPrice, maxPrice, minRating, offersOnly: searchParams.get("offersOnly") === "true", inStock: searchParams.get("inStock") === "true" };
}

function toProduct(row) {
  return {
    slug: row.slug,
    name: row.name,
    department: row.department_slug,
    departmentName: row.department_name,
    subcategory: row.category_name,
    subcategorySlug: row.category_slug,
    category: row.category_name,
    categorySlug: row.category_slug,
    price: Number(row.price_paise) / 100,
    mrp: Number(row.mrp_paise) / 100,
    rating: Number(row.rating),
    reviews: Number(row.review_count),
    image: row.image_url ?? "/images/products/story-books.webp",
    badge: row.badge ?? undefined,
    short: row.short_description,
    description: row.description,
    specs: row.specifications,
    inStock: Number(row.quantity_on_hand ?? 0) - Number(row.quantity_reserved ?? 0) > 0 || row.allow_backorder,
    availableQuantity: Math.max(0, Number(row.quantity_on_hand ?? 0) - Number(row.quantity_reserved ?? 0)),
    allowBackorder: row.allow_backorder,
  };
}

function toCategory(row) {
  return {
    slug: row.slug,
    name: row.name,
    short: row.description,
    image: row.image_url ?? "/images/products/story-books.webp",
    color: row.color_hex ?? "#f6f3ed",
    department: row.department_slug,
  };
}

const productSelect = `SELECT p.*, c.slug AS category_slug, c.name AS category_name,
  d.slug AS department_slug, d.name AS department_name,
  i.quantity_on_hand, i.quantity_reserved
  FROM products p
  JOIN categories c ON c.id = p.category_id
  JOIN departments d ON d.id = c.department_id
  LEFT JOIN inventory i ON i.product_id = p.id`;

export async function getDepartments(database) {
  if (!database) return sampleCatalog.departments;
  const result = await database.query("SELECT slug, name, description AS short, sort_order FROM departments WHERE is_active = true ORDER BY sort_order, name");
  return result.rows.map((row) => ({ slug: row.slug, name: row.name, short: row.short, image: row.slug === "books" ? "/images/products/story-books.webp" : "/images/products/office-set.webp", color: row.slug === "books" ? "#e8f5ee" : "#fff1d5" }));
}

export async function getCategories(database, department) {
  if (department && !["books", "stationery"].includes(department)) throw new RequestError(400, "Unknown department");
  if (!database) return sampleCatalog.categories.filter((category) => !department || category.department === department);
  const values = department ? [department] : [];
  const result = await database.query(`SELECT c.*, d.slug AS department_slug FROM categories c JOIN departments d ON d.id = c.department_id
    WHERE c.is_active = true AND d.is_active = true ${department ? "AND d.slug = $1" : ""}
    ORDER BY d.sort_order, c.sort_order, c.name`, values);
  return result.rows.map(toCategory);
}

export async function listProducts(database, searchParams) {
  const { limit, offset } = parsePagination(searchParams);
  const filters = parseFilters(searchParams);
  const department = searchParams.get("department") ?? "";
  const category = searchParams.get("category") ?? "";
  const q = (searchParams.get("q") ?? "").trim().slice(0, 100);
  const sort = searchParams.get("sort") ?? "popular";
  if (!allowedSorts.has(sort)) throw new RequestError(400, "Unknown sort order");
  if (department && !["books", "stationery"].includes(department)) throw new RequestError(400, "Unknown department");
  if (category && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category)) throw new RequestError(400, "Invalid category");

  if (!database) {
    const filtered = sampleCatalog.products.filter((product) =>
      (!department || product.department === department) &&
      (!category || product.categorySlug === category) &&
      (!q || `${product.name} ${product.short}`.toLowerCase().includes(q.toLowerCase())) &&
      product.price >= filters.minPrice && (filters.maxPrice === null || product.price <= filters.maxPrice) &&
      product.rating >= filters.minRating && (!filters.offersOnly || Boolean(product.badge)));
    const ordered = [...filtered].sort((a, b) => sort === "price_asc" ? a.price - b.price : sort === "price_desc" ? b.price - a.price : sort === "name" ? a.name.localeCompare(b.name) : sort === "new" ? b.slug.localeCompare(a.slug) : b.reviews - a.reviews);
    return { items: ordered.slice(offset, offset + limit), total: filtered.length, limit, offset, source: "sample" };
  }

  const values = [];
  const clauses = ["p.status = 'active'", "c.is_active = true", "d.is_active = true"];
  if (department) { values.push(department); clauses.push(`d.slug = $${values.length}`); }
  if (category) { values.push(category); clauses.push(`c.slug = $${values.length}`); }
  if (q) { values.push(`%${q}%`); clauses.push(`(p.name ILIKE $${values.length} OR p.short_description ILIKE $${values.length})`); }
  if (filters.minPrice > 0) { values.push(Math.round(filters.minPrice * 100)); clauses.push(`p.price_paise >= $${values.length}`); }
  if (filters.maxPrice !== null) { values.push(Math.round(filters.maxPrice * 100)); clauses.push(`p.price_paise <= $${values.length}`); }
  if (filters.minRating > 0) { values.push(filters.minRating); clauses.push(`p.rating >= $${values.length}`); }
  if (filters.offersOnly) clauses.push("p.badge IS NOT NULL");
  if (filters.inStock) clauses.push("(COALESCE(i.quantity_on_hand, 0) > COALESCE(i.quantity_reserved, 0) OR p.allow_backorder)");
  const where = clauses.join(" AND ");
  const order = {
    popular: "p.review_count DESC, p.name ASC",
    new: "p.created_at DESC, p.name ASC",
    price_asc: "p.price_paise ASC, p.name ASC",
    price_desc: "p.price_paise DESC, p.name ASC",
    name: "p.name ASC",
  }[sort];
  const count = await database.query(`SELECT count(*)::integer AS total FROM products p JOIN categories c ON c.id = p.category_id JOIN departments d ON d.id = c.department_id LEFT JOIN inventory i ON i.product_id = p.id WHERE ${where}`, values);
  values.push(limit, offset);
  const result = await database.query(`${productSelect} WHERE ${where} ORDER BY ${order} LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  return { items: result.rows.map(toProduct), total: count.rows[0].total, limit, offset, source: "database" };
}

export async function getProduct(database, slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new RequestError(400, "Invalid product slug");
  if (!database) return sampleCatalog.products.find((product) => product.slug === slug) ?? null;
  const result = await database.query(`${productSelect} WHERE p.slug = $1 AND p.status = 'active' AND c.is_active = true AND d.is_active = true`, [slug]);
  return result.rows[0] ? toProduct(result.rows[0]) : null;
}

export async function getProductsBySlugs(database, slugs) {
  if (!database) return sampleCatalog.products.filter((product) => slugs.includes(product.slug)).map((product) => ({ ...product, inStock: true, availableQuantity: 25, allowBackorder: false }));
  const result = await database.query(`${productSelect} WHERE p.slug = ANY($1::text[]) AND p.status = 'active' AND c.is_active = true AND d.is_active = true`, [slugs]);
  return result.rows.map(toProduct);
}
