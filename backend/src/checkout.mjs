import { getProductsBySlugs, RequestError } from "./catalog.mjs";

export async function quoteCart(database, input) {
  if (!input || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 50) {
    throw new RequestError(400, "Cart must contain 1–50 products");
  }
  const quantities = new Map();
  for (const item of input.items) {
    if (!item || typeof item.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) ||
        !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw new RequestError(400, "Invalid cart item");
    }
    const total = (quantities.get(item.slug) ?? 0) + item.quantity;
    if (total > 99) throw new RequestError(400, "Maximum quantity per product is 99");
    quantities.set(item.slug, total);
  }

  const products = await getProductsBySlugs(database, [...quantities.keys()]);
  if (products.length !== quantities.size) throw new RequestError(409, "Some products are no longer available");
  let mrpSubtotalPaise = 0;
  let subtotalPaise = 0;
  const items = products.map((product) => {
    const quantity = quantities.get(product.slug);
    if (!product.allowBackorder && product.availableQuantity < quantity) {
      throw new RequestError(409, `${product.name} has only ${product.availableQuantity} available`);
    }
    const unitPricePaise = Math.round(product.price * 100);
    const unitMrpPaise = Math.round(product.mrp * 100);
    mrpSubtotalPaise += unitMrpPaise * quantity;
    subtotalPaise += unitPricePaise * quantity;
    return { slug: product.slug, name: product.name, quantity, unitPricePaise, unitMrpPaise,
      lineTotalPaise: unitPricePaise * quantity, categorySlug: product.categorySlug };
  });
  if (!Number.isSafeInteger(subtotalPaise) || !Number.isSafeInteger(mrpSubtotalPaise)) throw new RequestError(400, "Cart total is too large");

  const fulfilment = input.fulfilment === "pickup" ? "pickup" : "delivery";
  const offerCode = typeof input.offerCode === "string" ? input.offerCode.trim().toUpperCase() : "";
  let offerDiscountPaise = 0;
  let appliedOffer = null;
  if (offerCode) {
    if (!database) throw new RequestError(503, "Offer codes require a connected database");
    const result = await database.query(`SELECT * FROM offers WHERE upper(code) = $1 AND is_active = true
      AND starts_at <= now() AND ends_at > now()`, [offerCode]);
    const offer = result.rows[0];
    if (!offer) throw new RequestError(400, "Offer code is not active");
    if (subtotalPaise < Number(offer.minimum_order_paise)) throw new RequestError(400, "Order does not meet the offer minimum");
    const targets = await database.query(`SELECT p.slug AS product_slug, NULL::text AS category_slug FROM offer_products op
      JOIN products p ON p.id = op.product_id WHERE op.offer_id = $1
      UNION ALL SELECT NULL::text, c.slug FROM offer_categories oc
      JOIN categories c ON c.id = oc.category_id WHERE oc.offer_id = $1`, [offer.id]);
    const eligibleProducts = new Set(targets.rows.map((row) => row.product_slug).filter(Boolean));
    const eligibleCategories = new Set(targets.rows.map((row) => row.category_slug).filter(Boolean));
    const eligiblePaise = targets.rows.length === 0 ? subtotalPaise : items.reduce((sum, item) =>
      sum + (eligibleProducts.has(item.slug) || eligibleCategories.has(item.categorySlug) ? item.lineTotalPaise : 0), 0);
    if (eligiblePaise === 0) throw new RequestError(400, "Offer does not apply to this cart");
    offerDiscountPaise = offer.discount_type === "percentage"
      ? Math.floor(eligiblePaise * offer.discount_value / 10000)
      : Math.min(eligiblePaise, offer.discount_value);
    if (offer.max_discount_paise !== null) offerDiscountPaise = Math.min(offerDiscountPaise, Number(offer.max_discount_paise));
    appliedOffer = { code: offerCode, name: offer.name };
  }

  const productSavingsPaise = mrpSubtotalPaise - subtotalPaise;
  const deliveryPaise = fulfilment === "pickup" ? 0 : null;
  const totalPaise = deliveryPaise === null ? null : subtotalPaise - offerDiscountPaise + deliveryPaise;
  return { items, currency: "INR", mrpSubtotalPaise, productSavingsPaise, subtotalPaise,
    offerDiscountPaise, deliveryPaise, totalPaise, fulfilment, appliedOffer,
    source: database ? "database" : "sample" };
}
