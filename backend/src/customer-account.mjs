import { z } from "zod";
import { RequestError } from "./catalog.mjs";

export function isVerified(user) { return Boolean(user?.emailVerified || user?.phoneNumberVerified); }
export async function requireCustomer(auth, headers) {
  const session = await auth.api.getSession({ headers });
  if (!session || session.user.banned) throw new RequestError(401, "Sign in to continue");
  if (!isVerified(session.user)) throw new RequestError(403, "Verify your email or phone number to continue");
  return session;
}
export function assertCustomerOrigin(request, origin) {
  if (request.headers.origin !== origin) throw new RequestError(403, "Invalid request origin");
}
export async function customerForUser(database, user) {
  const email = user.emailVerified && !user.email.endsWith(".invalid") ? user.email : null;
  const phone = user.phoneNumberVerified ? user.phoneNumber : null;
  const result = await database.query(`INSERT INTO customers (auth_user_id,email,phone,full_name) VALUES ($1,$2,$3,$4)
    ON CONFLICT (auth_user_id) DO UPDATE SET full_name=excluded.full_name,email=excluded.email,phone=excluded.phone,updated_at=now()
    RETURNING id,full_name,email,phone`, [user.id, email, phone, user.name]);
  return result.rows[0];
}
export async function accountSummary(database, customer) {
  const result = await database.query(`SELECT
    (SELECT count(*)::int FROM orders WHERE customer_id=$1) AS orders,
    (SELECT count(*)::int FROM orders WHERE customer_id=$1 AND status NOT IN ('delivered','cancelled','refunded')) AS active_orders,
    (SELECT count(*)::int FROM customer_addresses WHERE customer_id=$1) AS addresses`, [customer.id]);
  return { orders: result.rows[0].orders, activeOrders: result.rows[0].active_orders, addresses: result.rows[0].addresses };
}
export async function customerOrders(database, customer) {
  const result = await database.query("SELECT order_number,status,fulfillment_type,total_paise,placed_at FROM orders WHERE customer_id=$1 ORDER BY placed_at DESC", [customer.id]);
  return result.rows.map((row) => ({ number: row.order_number, status: row.status, fulfilment: row.fulfillment_type, totalPaise: Number(row.total_paise), placedAt: row.placed_at }));
}
export const profileInput = z.object({ name: z.string().trim().min(1).max(120) }).strict();

export async function customerOrder(database, customer, number) {
  const result = await database.query("SELECT id,order_number,status,fulfillment_type,total_paise,placed_at FROM orders WHERE customer_id=$1 AND order_number=$2", [customer.id, number]);
  const row = result.rows[0];
  if (!row) throw new RequestError(404, "Order not found");
  const items = await database.query("SELECT product_name,quantity,unit_price_paise,line_total_paise FROM order_items WHERE order_id=$1", [row.id]);
  return { number: row.order_number, status: row.status, fulfilment: row.fulfillment_type, totalPaise: Number(row.total_paise), placedAt: row.placed_at,
    items: items.rows.map((item) => ({ name: item.product_name, quantity: item.quantity, totalPaise: Number(item.line_total_paise) })) };
}
export async function customerAddresses(database, customer) {
  const result = await database.query("SELECT label,recipient_name,phone,line_1,line_2,city,state,postal_code,is_default FROM customer_addresses WHERE customer_id=$1 ORDER BY is_default DESC,created_at DESC", [customer.id]);
  return result.rows;
}
