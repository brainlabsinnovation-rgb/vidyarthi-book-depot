import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";
import dotenv from "dotenv";

// Optional current-project checks: no account creation, password changes,
// authenticated cookies, provider mail, orders or database writes.
export async function runLiveChecks() {
  const env = dotenv.parse(await readFile(new URL("../.env", import.meta.url)));
  const target = new URL(env.DATABASE_URL);
  assert.ok(target.hostname.includes("ep-divine-dust-b4yle6m0"), "Live audit must target the known Neon development branch");
  const database = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 15000 });
  const frontend = env.FRONTEND_ORIGIN || "http://localhost:3000";
  const backend = "http://localhost:" + (env.PORT || "4000");
  const cases = [];
  async function check(id, method, url, expected, body) {
    const response = await fetch(url, { method, signal: AbortSignal.timeout(20000), headers: { Origin: frontend, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    const passed = response.status === expected;
    cases.push({ id, method, url, expectedStatus: expected, observedStatus: response.status, status: passed ? "passed" : "failed", response: data });
    return data;
  }
  try {
    await database.connect();
    await database.query("BEGIN READ ONLY");
    const tables = ["user", "account", "session", "customers", "verification", "products", "categories", "orders", "payments"];
    const snapshot = async () => {
      const result = {};
      for (const table of tables) {
        const row = (await database.query(`SELECT count(*)::int AS count,md5(coalesce(string_agg(row_to_json(t)::text,'|' ORDER BY id::text),'')) AS fingerprint FROM public."${table}" t`)).rows[0];
        result[table] = row;
      }
      return result;
    };
    const before = await snapshot();
    const ready = await check("LIVE-01", "GET", backend + "/api/ready", 200);
    const providers = await check("LIVE-02", "GET", frontend + "/api/store/auth-config", 200);
    await check("LIVE-03", "GET", frontend + "/api/auth/get-session", 200);
    let index = 4;
    for (const path of ["customer/me", "customer/summary", "customer/orders", "customer/addresses", "admin/products"]) {
      for (const base of [backend + "/api/", frontend + "/api/store/"]) await check("LIVE-" + String(index++).padStart(2, "0"), "GET", base + path, 401);
    }
    for (const base of [backend + "/api/", frontend + "/api/store/"]) await check("LIVE-" + String(index++).padStart(2, "0"), "POST", base + "checkout/prepare", 401, { items: [] });
    for (const base of [backend, frontend]) await check("LIVE-" + String(index++).padStart(2, "0"), "POST", base + "/api/auth/email-otp/request-password-reset", 400, { email: "live-audit-unknown@example.invalid" });
    const after = await snapshot();
    const recordsUnchanged = JSON.stringify(before) === JSON.stringify(after);
    cases.push({ id: "LIVE-DB", title: "Existing Neon records untouched", status: recordsUnchanged ? "passed" : "inconclusive", before, after,
      note: "Only SELECT queries in a READ ONLY transaction; API requests used no session cookies. Concurrent user activity can change fingerprints." });
    await database.query("COMMIT");
    return { at: new Date().toISOString(), target: "Neon development / neondb / public", databaseReadOnly: true, recordsUnchanged, providers, ready,
      counts: { total: cases.length, passed: cases.filter((item) => item.status === "passed").length, failed: cases.filter((item) => item.status === "failed").length }, cases };
  } finally { await database.end(); }
}
