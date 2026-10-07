import { readFile } from "node:fs/promises";
import { createDatabaseClient } from "./shared.mjs";

if (process.env.SAMPLE_SEED_CONFIRM !== "yes") {
  throw new Error("Sample seeding is opt-in. Set SAMPLE_SEED_CONFIRM=yes for a development database.");
}

const sample = JSON.parse(await readFile(new URL("../seeds/sample-catalog.json", import.meta.url), "utf8"));
const client = createDatabaseClient();
await client.connect();

try {
  await client.query("BEGIN");
  for (const [index, department] of sample.departments.entries()) {
    await client.query(`INSERT INTO departments (slug, name, description, sort_order)
      VALUES ($1, $2, $3, $4) ON CONFLICT (slug) DO NOTHING`,
    [department.slug, department.name, department.short, index]);
  }
  for (const [index, category] of sample.categories.entries()) {
    await client.query(`INSERT INTO categories (department_id, slug, name, description, image_url, color_hex, sort_order)
      SELECT id, $2, $3, $4, $5, $6, $7 FROM departments WHERE slug = $1
      ON CONFLICT (slug) DO NOTHING`,
    [category.department, category.slug, category.name, category.short, category.image, category.color, index]);
  }
  for (const product of sample.products) {
    const result = await client.query(`INSERT INTO products
      (category_id, slug, name, short_description, description, specifications, price_paise, mrp_paise,
       status, image_url, badge, rating, review_count)
      SELECT id, $2, $3, $4, $5, $6::jsonb, $7, $8, 'active', $9, $10, $11, $12
      FROM categories WHERE slug = $1
      ON CONFLICT (slug) DO NOTHING RETURNING id`,
    [product.categorySlug, product.slug, product.name, product.short, product.description,
      JSON.stringify(product.specs), Math.round(product.price * 100), Math.round(product.mrp * 100),
      product.image, product.badge ?? null, product.rating, product.reviews]);
    if (result.rows[0]) {
      await client.query("INSERT INTO inventory (product_id, quantity_on_hand, low_stock_threshold) VALUES ($1, 25, 5)", [result.rows[0].id]);
    }
  }
  await client.query("COMMIT");
  console.log(`Sample catalog seeded without overwriting existing rows: ${sample.departments.length} departments, ${sample.categories.length} categories, ${sample.products.length} products.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
