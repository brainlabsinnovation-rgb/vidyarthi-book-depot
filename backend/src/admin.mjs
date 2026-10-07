import { z } from "zod";
import { RequestError } from "./catalog.mjs";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const optionalText = z.string().trim().max(5000).optional().default("");
const productInput = z.object({
  name: z.string().trim().min(1).max(240),
  slug: slug.optional(),
  categorySlug: slug,
  sku: z.string().trim().max(100).nullable().optional(),
  short: z.string().trim().max(500).optional().default(""),
  description: optionalText,
  specs: z.record(z.string(), z.string()).optional().default({}),
  price: z.number().nonnegative().max(10_000_000),
  mrp: z.number().nonnegative().max(10_000_000),
  cost: z.number().nonnegative().max(10_000_000).nullable().optional(),
  imageUrl: z.string().trim().max(2000).nullable().optional(),
  badge: z.string().trim().max(100).nullable().optional(),
  brand: z.string().trim().max(120).nullable().optional(),
  unit: z.string().trim().max(40).optional().default("piece"),
  taxRateBps: z.number().int().min(0).max(10000).optional().default(0),
  stock: z.number().int().min(0).max(1_000_000).optional().default(0),
  lowStockThreshold: z.number().int().min(0).max(1_000_000).optional().default(0),
  status: z.enum(["draft", "active", "archived"]).optional().default("draft"),
  featured: z.boolean().optional().default(false),
  allowBackorder: z.boolean().optional().default(false),
  seoTitle: z.string().trim().max(240).nullable().optional(),
}).refine((value) => value.mrp >= value.price, { message: "MRP must be at least the selling price" });

const categoryInput = z.object({
  name: z.string().trim().min(1).max(160),
  slug: slug.optional(),
  department: z.enum(["books", "stationery"]),
  description: optionalText,
  imageUrl: z.string().trim().max(2000).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional().default(0),
  active: z.boolean().optional().default(true),
  showInNavigation: z.boolean().optional().default(true),
  featured: z.boolean().optional().default(false),
  seoDescription: z.string().trim().max(500).optional().default(""),
});

const inventoryInput = z.object({
  productSlug: slug,
  delta: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0),
  reason: z.enum(["restock", "return", "correction", "damage"]),
  note: z.string().trim().max(500).optional().default(""),
});

const offerInput = z.object({
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().max(80).nullable().optional(),
  description: optionalText,
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().positive().max(10_000_000),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  active: z.boolean().optional().default(true),
  minimumOrder: z.number().nonnegative().optional().default(0),
  maxDiscount: z.number().positive().nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  productSlugs: z.array(slug).max(1000).optional().default([]),
  categorySlugs: z.array(slug).max(1000).optional().default([]),
}).refine((value) => new Date(value.endsAt) > new Date(value.startsAt), { message: "Offer end must follow its start" })
  .refine((value) => value.discountType !== "percentage" || value.discountValue <= 100, { message: "Percentage cannot exceed 100" });

function parse(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) throw new RequestError(400, result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  return result.data;
}

function slugify(name) {
  const value = name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!value) throw new RequestError(400, "A URL slug is required for this name");
  return value;
}

async function transaction(database, action) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

const adminProductSelect = `SELECT p.slug, p.name, p.sku, p.status, p.price_paise, p.mrp_paise,
    p.short_description, p.description, p.specifications, p.image_url, p.badge, p.brand, p.unit,
    p.tax_rate_bps, p.cost_paise, p.is_featured, p.allow_backorder, p.seo_title,
    p.rating, p.review_count, p.updated_at, c.slug AS category_slug, c.name AS category_name,
    d.slug AS department, COALESCE(i.quantity_on_hand, 0) AS stock,
    COALESCE(i.quantity_reserved, 0) AS reserved, COALESCE(i.low_stock_threshold, 0) AS low_stock_threshold
    FROM products p JOIN categories c ON c.id = p.category_id JOIN departments d ON d.id = c.department_id
    LEFT JOIN inventory i ON i.product_id = p.id`;

function mapAdminProduct(row) { return {
    slug: row.slug, name: row.name, sku: row.sku, status: row.status,
    price: Number(row.price_paise) / 100, mrp: Number(row.mrp_paise) / 100,
    short: row.short_description, description: row.description, specs: row.specifications,
    imageUrl: row.image_url, badge: row.badge, brand: row.brand, unit: row.unit,
    taxRateBps: row.tax_rate_bps, cost: row.cost_paise === null ? null : Number(row.cost_paise) / 100,
    featured: row.is_featured, allowBackorder: row.allow_backorder, seoTitle: row.seo_title,
    rating: Number(row.rating), reviews: row.review_count, updatedAt: row.updated_at,
    categorySlug: row.category_slug, categoryName: row.category_name, department: row.department,
    stock: Number(row.stock), reserved: Number(row.reserved), lowStockThreshold: Number(row.low_stock_threshold),
  }; }

export async function listAdminProducts(database) {
  const result = await database.query(`${adminProductSelect} ORDER BY p.updated_at DESC LIMIT 10000`);
  return result.rows.map(mapAdminProduct);
}

export async function getAdminProduct(database, slugValue) {
  const result = await database.query(`${adminProductSelect} WHERE p.slug=$1`, [slugValue]);
  if (!result.rows[0]) throw new RequestError(404, "Product not found");
  return mapAdminProduct(result.rows[0]);
}

export async function saveProduct(database, body, existingSlug = null) {
  const value = parse(productInput, body);
  const productSlug = value.slug ?? existingSlug ?? slugify(value.name);
  return transaction(database, async (client) => {
    const category = await client.query("SELECT id FROM categories WHERE slug = $1 AND is_active = true", [value.categorySlug]);
    if (!category.rows[0]) throw new RequestError(400, "Category does not exist or is inactive");
    const fields = [category.rows[0].id, productSlug, value.name, value.sku || null, value.short, value.description,
      JSON.stringify(value.specs), Math.round(value.price * 100), Math.round(value.mrp * 100), value.status,
      value.imageUrl || null, value.badge || null, value.brand || null, value.unit, value.taxRateBps,
      value.cost === undefined || value.cost === null ? null : Math.round(value.cost * 100),
      value.featured, value.allowBackorder, value.seoTitle || null];
    let result;
    if (existingSlug) {
      result = await client.query(`UPDATE products SET category_id=$1, slug=$2, name=$3, sku=$4,
        short_description=$5, description=$6, specifications=$7::jsonb, price_paise=$8, mrp_paise=$9,
        status=$10, image_url=$11, badge=$12, brand=$13, unit=$14, tax_rate_bps=$15, cost_paise=$16,
        is_featured=$17, allow_backorder=$18, seo_title=$19, updated_at=now()
        WHERE slug=$20 RETURNING id, slug`, [...fields, existingSlug]);
    } else {
      result = await client.query(`INSERT INTO products (category_id, slug, name, sku, short_description,
        description, specifications, price_paise, mrp_paise, status, image_url, badge, brand, unit,
        tax_rate_bps, cost_paise, is_featured, allow_backorder, seo_title)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        RETURNING id, slug`, fields);
    }
    if (!result.rows[0]) throw new RequestError(404, "Product not found");
    const productId = result.rows[0].id;
    if (existingSlug) {
      const inventory = await client.query("SELECT quantity_on_hand, quantity_reserved FROM inventory WHERE product_id=$1 FOR UPDATE", [productId]);
      if (!inventory.rows[0]) throw new RequestError(409, "Product inventory is missing");
      if (value.stock < inventory.rows[0].quantity_reserved) throw new RequestError(400, "Stock cannot fall below reserved quantity");
      const delta = value.stock - inventory.rows[0].quantity_on_hand;
      await client.query("UPDATE inventory SET quantity_on_hand=$2, low_stock_threshold=$3, updated_at=now() WHERE product_id=$1", [productId, value.stock, value.lowStockThreshold]);
      if (delta !== 0) await client.query("INSERT INTO inventory_movements (product_id, delta, reason, note) VALUES ($1,$2,'correction','Product edit')", [productId, delta]);
    } else {
      await client.query("INSERT INTO inventory (product_id, quantity_on_hand, low_stock_threshold) VALUES ($1,$2,$3)", [productId, value.stock, value.lowStockThreshold]);
      if (value.stock > 0) await client.query("INSERT INTO inventory_movements (product_id, delta, reason, note) VALUES ($1,$2,'restock','Initial stock')", [productId, value.stock]);
    }
    return { slug: result.rows[0].slug };
  });
}

export async function listAdminCategories(database) {
  const result = await database.query(`SELECT c.slug, c.name, c.description, c.image_url, c.color_hex, c.sort_order,
    c.is_active, c.show_in_navigation, c.is_featured, c.seo_description, c.updated_at,
    d.slug AS department, d.name AS department_name, count(p.id)::integer AS product_count
    FROM categories c JOIN departments d ON d.id = c.department_id LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id, d.id ORDER BY d.sort_order, c.sort_order, c.name`);
  return result.rows.map((row) => ({ slug: row.slug, name: row.name, description: row.description,
    imageUrl: row.image_url, color: row.color_hex, sortOrder: row.sort_order, active: row.is_active,
    showInNavigation: row.show_in_navigation, featured: row.is_featured, seoDescription: row.seo_description,
    updatedAt: row.updated_at, department: row.department, departmentName: row.department_name,
    productCount: row.product_count }));
}

export async function saveCategory(database, body, existingSlug = null) {
  const value = parse(categoryInput, body);
  const categorySlug = value.slug ?? existingSlug ?? slugify(value.name);
  const fields = [value.department, categorySlug, value.name, value.description, value.imageUrl || null,
    value.color || null, value.sortOrder, value.active, value.showInNavigation, value.featured, value.seoDescription];
  let result;
  if (existingSlug) {
    result = await database.query(`UPDATE categories SET department_id=(SELECT id FROM departments WHERE slug=$1),
      slug=$2, name=$3, description=$4, image_url=$5, color_hex=$6, sort_order=$7, is_active=$8,
      show_in_navigation=$9, is_featured=$10, seo_description=$11, updated_at=now()
      WHERE slug=$12 RETURNING slug`, [...fields, existingSlug]);
  } else {
    result = await database.query(`INSERT INTO categories (department_id, slug, name, description, image_url,
      color_hex, sort_order, is_active, show_in_navigation, is_featured, seo_description)
      SELECT id,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11 FROM departments WHERE slug=$1 RETURNING slug`, fields);
  }
  if (!result.rows[0]) throw new RequestError(existingSlug ? 404 : 400, existingSlug ? "Category not found" : "Department not found");
  return { slug: result.rows[0].slug };
}

export async function adjustInventory(database, body) {
  const value = parse(inventoryInput, body);
  return transaction(database, async (client) => {
    const result = await client.query(`SELECT p.id, i.quantity_on_hand, i.quantity_reserved FROM products p
      JOIN inventory i ON i.product_id=p.id WHERE p.slug=$1 FOR UPDATE OF i`, [value.productSlug]);
    const row = result.rows[0];
    if (!row) throw new RequestError(404, "Product inventory not found");
    const next = row.quantity_on_hand + value.delta;
    if (next < row.quantity_reserved) throw new RequestError(400, "Stock cannot fall below reserved quantity");
    await client.query("UPDATE inventory SET quantity_on_hand=$2, updated_at=now() WHERE product_id=$1", [row.id, next]);
    await client.query("INSERT INTO inventory_movements (product_id, delta, reason, note) VALUES ($1,$2,$3,$4)", [row.id, value.delta, value.reason, value.note]);
    return { productSlug: value.productSlug, quantityOnHand: next };
  });
}

export async function listAdminOffers(database) {
  const result = await database.query(`SELECT o.id, o.code, o.name, o.description, o.discount_type,
    o.discount_value, o.max_discount_paise, o.minimum_order_paise, o.starts_at, o.ends_at,
    o.usage_limit, o.is_active, o.updated_at,
    (SELECT count(*)::integer FROM orders ord WHERE ord.offer_id=o.id AND ord.status <> 'cancelled') AS uses
    FROM offers o ORDER BY o.starts_at DESC LIMIT 1000`);
  const items = [];
  for (const row of result.rows) {
    const targets = await database.query(`SELECT p.slug AS product_slug, NULL::text AS category_slug FROM offer_products op
      JOIN products p ON p.id=op.product_id WHERE op.offer_id=$1
      UNION ALL SELECT NULL::text, c.slug FROM offer_categories oc
      JOIN categories c ON c.id=oc.category_id WHERE oc.offer_id=$1`, [row.id]);
    items.push({ id: row.id, code: row.code, name: row.name, description: row.description,
      discountType: row.discount_type, discountValue: row.discount_type === "percentage" ? row.discount_value / 100 : row.discount_value / 100,
      maxDiscount: row.max_discount_paise === null ? null : Number(row.max_discount_paise) / 100,
      minimumOrder: Number(row.minimum_order_paise) / 100, startsAt: row.starts_at,
      endsAt: row.ends_at, usageLimit: row.usage_limit, active: row.is_active, updatedAt: row.updated_at,
      uses: row.uses, productSlugs: targets.rows.map((target) => target.product_slug).filter(Boolean),
      categorySlugs: targets.rows.map((target) => target.category_slug).filter(Boolean) });
  }
  return items;
}

export async function saveOffer(database, body, existingId = null) {
  const value = parse(offerInput, body);
  const discountValue = value.discountType === "percentage" ? Math.round(value.discountValue * 100) : Math.round(value.discountValue * 100);
  return transaction(database, async (client) => {
    const fields = [value.code?.toUpperCase() || null, value.name, value.description,
      value.discountType, discountValue, value.maxDiscount === null || value.maxDiscount === undefined ? null : Math.round(value.maxDiscount * 100),
      Math.round(value.minimumOrder * 100), value.startsAt, value.endsAt, value.usageLimit ?? null, value.active];
    let result;
    if (existingId) {
      result = await client.query(`UPDATE offers SET code=$1, name=$2, description=$3, discount_type=$4,
        discount_value=$5, max_discount_paise=$6, minimum_order_paise=$7, starts_at=$8,
        ends_at=$9, usage_limit=$10, is_active=$11, updated_at=now() WHERE id=$12 RETURNING id`, [...fields, existingId]);
    } else {
      result = await client.query(`INSERT INTO offers (code, name, description, discount_type, discount_value,
        max_discount_paise, minimum_order_paise, starts_at, ends_at, usage_limit, is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`, fields);
    }
    if (!result.rows[0]) throw new RequestError(404, "Offer not found");
    const id = result.rows[0].id;
    await client.query("DELETE FROM offer_products WHERE offer_id=$1", [id]);
    await client.query("DELETE FROM offer_categories WHERE offer_id=$1", [id]);
    for (const productSlug of value.productSlugs) {
      const target = await client.query("INSERT INTO offer_products (offer_id, product_id) SELECT $1,id FROM products WHERE slug=$2 RETURNING product_id", [id, productSlug]);
      if (!target.rows[0]) throw new RequestError(400, `Unknown product ${productSlug}`);
    }
    for (const categorySlug of value.categorySlugs) {
      const target = await client.query("INSERT INTO offer_categories (offer_id, category_id) SELECT $1,id FROM categories WHERE slug=$2 RETURNING category_id", [id, categorySlug]);
      if (!target.rows[0]) throw new RequestError(400, `Unknown category ${categorySlug}`);
    }
    return { id };
  });
}

export function mapDatabaseError(error) {
  if (error instanceof RequestError) return error;
  if (error?.code === "23505") return new RequestError(409, "A record with this slug or SKU already exists");
  if (error?.code === "23503" || error?.code === "23514") return new RequestError(400, "This change violates a catalog constraint");
  return error;
}
