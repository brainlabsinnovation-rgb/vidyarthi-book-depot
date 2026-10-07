import "dotenv/config";
import { createServer } from "node:http";
import pg from "pg";
import { getCategories, getDepartments, getProduct, listProducts, RequestError } from "./catalog.mjs";
import { quoteCart } from "./checkout.mjs";
import { adjustInventory, getAdminProduct, listAdminCategories, listAdminOffers, listAdminProducts, mapDatabaseError, saveCategory, saveOffer, saveProduct } from "./admin.mjs";
import { getAdminReports, getAdminSummary, listAdminCustomers, listAdminMedia, listAdminOrders } from "./admin-dashboard.mjs";
import { requireCustomer, assertCustomerOrigin, customerForUser, accountSummary, customerOrders, customerOrder, customerAddresses } from "./customer-account.mjs";

const port = Number(process.env.PORT ?? 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const database = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000, max: 2 })
  : null;
const authNode = database && process.env.BETTER_AUTH_SECRET ? await import("better-auth/node") : null;
const authModule = authNode ? await import("./auth.mjs") : null;
const auth = authModule?.auth ?? null;
const authHandler = auth ? authNode.toNodeHandler(auth) : null;

async function readJson(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 65_536) throw new RequestError(413, "Request too large");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new RequestError(400, "Invalid JSON"); }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const path = url.pathname;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");

  if (request.method === "GET" && path === "/api/auth-config") {
    response.writeHead(200);
    response.end(JSON.stringify({ emailPassword: Boolean(auth), email: Boolean(authModule?.delivery.emailEnabled), phone: Boolean(authModule?.delivery.phoneEnabled),
      google: Boolean(auth && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      facebook: Boolean(auth && process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) }));
    return;
  }

  if (path.startsWith("/api/customer/") || path === "/api/checkout/prepare" || path === "/api/checkout/orders") {
    try {
      if (!database || !auth) throw new RequestError(503, "Account services are unavailable");
      if (request.method !== "GET") assertCustomerOrigin(request, process.env.FRONTEND_ORIGIN || "http://localhost:3000");
      const session = await requireCustomer(auth, authNode.fromNodeHeaders(request.headers));
      const customer = await customerForUser(database, session.user);
      let body;
      if (request.method === "GET" && path === "/api/customer/me") body = { user: { name: session.user.name, email: customer.email, phone: customer.phone }, customerId: customer.id };
      else if (request.method === "GET" && path === "/api/customer/summary") body = await accountSummary(database, customer);
      else if (request.method === "GET" && path === "/api/customer/orders") body = { items: await customerOrders(database, customer) };
      else if (request.method === "GET" && path.startsWith("/api/customer/orders/")) body = await customerOrder(database, customer, decodeURIComponent(path.slice("/api/customer/orders/".length)));
      else if (request.method === "GET" && path === "/api/customer/addresses") body = { items: await customerAddresses(database, customer) };
      else if (request.method === "POST" && path === "/api/checkout/prepare") body = { ...await quoteCart(database, await readJson(request)), canPlaceOrder: false };
      else if (request.method === "POST" && path === "/api/checkout/orders") throw new RequestError(503, "Order placement is waiting for payment and fulfilment setup");
      else throw new RequestError(404, "Account route not found");
      response.writeHead(200);
      response.end(JSON.stringify(body));
    } catch (rawError) {
      const error = mapDatabaseError(rawError);
      const status = error instanceof RequestError ? error.status : 503;
      response.writeHead(status);
      response.end(JSON.stringify({ error: status === 503 ? "account_unavailable" : error.message }));
    }
    return;
  }

  if (path.startsWith("/api/auth/")) {
    if (!authHandler) {
      response.writeHead(503);
      response.end(JSON.stringify({ error: "auth_not_configured" }));
      return;
    }
    try { await authHandler(request, response); }
    catch (error) {
      console.error("Authentication request failed.");
      if (!response.headersSent) response.writeHead(503);
      if (!response.writableEnded) response.end(JSON.stringify({ error: "auth_unavailable" }));
    }
    return;
  }

  if (request.method === "GET" && path === "/api/health") {
    response.writeHead(200);
    response.end(JSON.stringify({ service: "vidyarthi-backend", status: "ok" }));
    return;
  }

  if (request.method === "GET" && path === "/api/ready") {
    if (!database) {
      response.writeHead(503);
      response.end(JSON.stringify({ status: "not_ready", database: "not_configured" }));
      return;
    }
    try {
      await database.query("SELECT 1");
      response.writeHead(200);
      response.end(JSON.stringify({ status: "ready", database: "connected" }));
    } catch {
      response.writeHead(503);
      response.end(JSON.stringify({ status: "not_ready", database: "unavailable" }));
    }
    return;
  }

  if (request.method === "GET" && path.startsWith("/api/catalog/")) {
    try {
      let body;
      if (path === "/api/catalog/departments") body = { items: await getDepartments(database) };
      else if (path === "/api/catalog/categories") body = { items: await getCategories(database, url.searchParams.get("department")) };
      else if (path === "/api/catalog/products") body = await listProducts(database, url.searchParams);
      else if (path.startsWith("/api/catalog/products/")) {
        const slug = path.slice("/api/catalog/products/".length);
        body = await getProduct(database, slug);
        if (!body) {
          response.writeHead(404);
          response.end(JSON.stringify({ error: "product_not_found" }));
          return;
        }
      } else {
        response.writeHead(404);
        response.end(JSON.stringify({ error: "not_found" }));
        return;
      }
      response.writeHead(200);
      response.end(JSON.stringify(body));
    } catch (error) {
      const status = error instanceof RequestError ? error.status : 503;
      if (!(error instanceof RequestError)) console.error("Catalog query failed:", error);
      response.writeHead(status);
      response.end(JSON.stringify({ error: status === 503 ? "catalog_unavailable" : error.message }));
    }
    return;
  }

  if (request.method === "POST" && path === "/api/checkout/quote") {
    try {
      const quote = await quoteCart(database, await readJson(request));
      response.writeHead(200);
      response.end(JSON.stringify(quote));
    } catch (error) {
      const status = error instanceof RequestError ? error.status : 503;
      if (!(error instanceof RequestError)) console.error("Quote failed:", error);
      response.writeHead(status);
      response.end(JSON.stringify({ error: status === 503 ? "checkout_unavailable" : error.message }));
    }
    return;
  }

  if (path.startsWith("/api/admin/")) {
    if (!database || !auth) {
      response.writeHead(503);
      response.end(JSON.stringify({ error: "admin_not_configured" }));
      return;
    }
    try {
      const session = await auth.api.getSession({ headers: authNode.fromNodeHeaders(request.headers) });
      if (!session) throw new RequestError(401, "Sign in required");
      if (!String(session.user.role ?? "").split(",").includes("admin")) throw new RequestError(403, "Admin access required");
      let body;
      let status = 200;
      if (request.method === "GET" && path === "/api/admin/products") body = { items: await listAdminProducts(database) };
      else if (request.method === "GET" && path.startsWith("/api/admin/products/")) body = await getAdminProduct(database, path.slice("/api/admin/products/".length));
      else if (request.method === "POST" && path === "/api/admin/products") { body = await saveProduct(database, await readJson(request)); status = 201; }
      else if (request.method === "PUT" && path.startsWith("/api/admin/products/")) body = await saveProduct(database, await readJson(request), path.slice("/api/admin/products/".length));
      else if (request.method === "GET" && path === "/api/admin/categories") body = { items: await listAdminCategories(database) };
      else if (request.method === "GET" && path.startsWith("/api/admin/categories/")) {
        const category = (await listAdminCategories(database)).find((item) => item.slug === path.slice("/api/admin/categories/".length));
        if (!category) throw new RequestError(404, "Category not found");
        body = category;
      }
      else if (request.method === "POST" && path === "/api/admin/categories") { body = await saveCategory(database, await readJson(request)); status = 201; }
      else if (request.method === "PUT" && path.startsWith("/api/admin/categories/")) body = await saveCategory(database, await readJson(request), path.slice("/api/admin/categories/".length));
      else if (request.method === "POST" && path === "/api/admin/inventory/adjust") body = await adjustInventory(database, await readJson(request));
      else if (request.method === "GET" && path === "/api/admin/offers") body = { items: await listAdminOffers(database) };
      else if (request.method === "GET" && path.startsWith("/api/admin/offers/")) {
        const offer = (await listAdminOffers(database)).find((item) => item.id === path.slice("/api/admin/offers/".length));
        if (!offer) throw new RequestError(404, "Offer not found");
        body = offer;
      }
      else if (request.method === "POST" && path === "/api/admin/offers") { body = await saveOffer(database, await readJson(request)); status = 201; }
      else if (request.method === "PUT" && path.startsWith("/api/admin/offers/")) body = await saveOffer(database, await readJson(request), path.slice("/api/admin/offers/".length));
      else if (request.method === "GET" && path === "/api/admin/summary") body = await getAdminSummary(database);
      else if (request.method === "GET" && path === "/api/admin/orders") body = { items: await listAdminOrders(database) };
      else if (request.method === "GET" && path === "/api/admin/customers") body = { items: await listAdminCustomers(database) };
      else if (request.method === "GET" && path === "/api/admin/reports") body = await getAdminReports(database);
      else if (request.method === "GET" && path === "/api/admin/media") body = { items: await listAdminMedia(database) };
      else throw new RequestError(404, "Admin route not found");
      response.writeHead(status);
      response.end(JSON.stringify(body));
    } catch (rawError) {
      const error = mapDatabaseError(rawError);
      const status = error instanceof RequestError ? error.status : 503;
      if (!(error instanceof RequestError)) console.error("Admin request failed:", error);
      response.writeHead(status);
      response.end(JSON.stringify({ error: status === 503 ? "admin_unavailable" : error.message }));
    }
    return;
  }

  response.writeHead(404);
  response.end(JSON.stringify({ error: "not_found" }));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Backend running at http://localhost:${port}`);
});

async function shutdown() {
  server.close();
  await database?.end();
  await authModule?.authDatabase.end();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
