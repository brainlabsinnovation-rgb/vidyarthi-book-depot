export async function getAdminSummary(database) {
  const [stats, recent, low] = await Promise.all([
    database.query(`SELECT
      (SELECT count(*)::integer FROM orders WHERE placed_at >= current_date) AS orders_today,
      (SELECT COALESCE(sum(o.total_paise),0)::bigint FROM orders o
        WHERE o.placed_at >= current_date AND EXISTS
        (SELECT 1 FROM payments p WHERE p.order_id=o.id AND p.status='captured')) AS revenue_today_paise,
      (SELECT count(*)::integer FROM inventory WHERE quantity_on_hand > quantity_reserved) AS products_in_stock,
      (SELECT count(*)::integer FROM customers) AS customers`),
    database.query(`SELECT order_number, customer_name, status, total_paise FROM orders ORDER BY placed_at DESC LIMIT 5`),
    database.query(`SELECT p.name, (i.quantity_on_hand-i.quantity_reserved) AS available FROM inventory i
      JOIN products p ON p.id=i.product_id WHERE i.low_stock_threshold > 0
      AND (i.quantity_on_hand-i.quantity_reserved) <= i.low_stock_threshold
      ORDER BY available ASC LIMIT 5`),
  ]);
  return {
    ordersToday: stats.rows[0].orders_today,
    revenueTodayPaise: Number(stats.rows[0].revenue_today_paise),
    productsInStock: stats.rows[0].products_in_stock,
    customers: stats.rows[0].customers,
    recentOrders: recent.rows.map((row) => ({ number: row.order_number, customer: row.customer_name,
      status: row.status, totalPaise: Number(row.total_paise) })),
    lowStock: low.rows.map((row) => ({ name: row.name, available: row.available })),
  };
}

export async function listAdminOrders(database) {
  const result = await database.query(`SELECT o.id, o.order_number, o.customer_name, o.fulfillment_type,
    o.status, o.total_paise, o.placed_at, count(oi.id)::integer AS item_count
    FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id
    GROUP BY o.id ORDER BY o.placed_at DESC LIMIT 1000`);
  return result.rows.map((row) => ({ id: row.id, number: row.order_number, customer: row.customer_name,
    fulfilment: row.fulfillment_type, status: row.status, totalPaise: Number(row.total_paise),
    placedAt: row.placed_at, itemCount: row.item_count }));
}

export async function listAdminCustomers(database) {
  const result = await database.query(`SELECT c.id, c.full_name, c.phone, c.email, c.created_at,
    count(o.id)::integer AS order_count, COALESCE(sum(o.total_paise),0)::bigint AS spent_paise,
    max(o.placed_at) AS last_order_at
    FROM customers c LEFT JOIN orders o ON o.customer_id=c.id AND o.status <> 'cancelled'
    GROUP BY c.id ORDER BY c.created_at DESC LIMIT 1000`);
  return result.rows.map((row) => ({ id: row.id, name: row.full_name, phone: row.phone,
    email: row.email, createdAt: row.created_at, orderCount: row.order_count,
    spentPaise: Number(row.spent_paise), lastOrderAt: row.last_order_at }));
}

export async function getAdminReports(database) {
  const [totals, months, categories] = await Promise.all([
    database.query(`SELECT count(DISTINCT o.id)::integer AS orders,
      COALESCE(sum(o.total_paise),0)::bigint AS sales_paise,
      count(DISTINCT o.customer_id)::integer AS customers
      FROM orders o WHERE EXISTS (SELECT 1 FROM payments p WHERE p.order_id=o.id AND p.status='captured')`),
    database.query(`SELECT date_trunc('month', o.placed_at) AS month, COALESCE(sum(o.total_paise),0)::bigint AS sales_paise
      FROM orders o WHERE o.placed_at >= date_trunc('month', now()) - interval '11 months'
      AND EXISTS (SELECT 1 FROM payments p WHERE p.order_id=o.id AND p.status='captured')
      GROUP BY 1 ORDER BY 1`),
    database.query(`SELECT c.name, COALESCE(sum(oi.line_total_paise),0)::bigint AS sales_paise
      FROM order_items oi JOIN products p ON p.id=oi.product_id JOIN categories c ON c.id=p.category_id
      JOIN orders o ON o.id=oi.order_id WHERE EXISTS
      (SELECT 1 FROM payments pay WHERE pay.order_id=o.id AND pay.status='captured')
      GROUP BY c.id ORDER BY sales_paise DESC LIMIT 5`),
  ]);
  const row = totals.rows[0];
  return { orders: row.orders, salesPaise: Number(row.sales_paise), customers: row.customers,
    averageOrderPaise: row.orders ? Math.round(Number(row.sales_paise) / row.orders) : 0,
    monthlySales: months.rows.map((item) => ({ month: item.month, salesPaise: Number(item.sales_paise) })),
    categories: categories.rows.map((item) => ({ name: item.name, salesPaise: Number(item.sales_paise) })) };
}

export async function listAdminMedia(database) {
  const result = await database.query(`SELECT 'product' AS kind, p.slug AS owner_slug,
      COALESCE(pi.object_key, p.image_url) AS path, pi.alt_text, pi.storage_bucket
      FROM products p LEFT JOIN product_images pi ON pi.product_id=p.id
      WHERE pi.object_key IS NOT NULL OR p.image_url IS NOT NULL
    UNION ALL SELECT 'category', c.slug, COALESCE(c.image_key,c.image_url), '', NULL::text
      FROM categories c WHERE c.image_key IS NOT NULL OR c.image_url IS NOT NULL
    ORDER BY kind, owner_slug LIMIT 10000`);
  return result.rows.map((row) => ({ kind: row.kind, ownerSlug: row.owner_slug, path: row.path,
    alt: row.alt_text, bucket: row.storage_bucket }));
}
