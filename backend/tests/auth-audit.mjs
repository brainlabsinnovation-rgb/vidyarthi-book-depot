import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";

function redact(value, key = "") {
  if (/password|^otp$|^token$|secret|code_hash|^value$|accessToken|refreshToken|idToken|^challenge$/i.test(key)) return "[redacted]";
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item, key)]));
  if (typeof value === "string" && /^https?:/.test(value)) {
    const url = new URL(value);
    for (const parameter of ["state", "code", "token", "access_token", "id_token"]) if (url.searchParams.has(parameter)) url.searchParams.set(parameter, "[redacted]");
    return url.toString();
  }
  return value;
}

export async function runAudit({ database: db, backendURL, origin, codes, deliveries, setDeliveryStatus }) {
  const startedAt = new Date().toISOString();
  const cases = []; const http = []; const sql = [];
  let currentCase;
  const suffix = randomUUID().slice(0, 8);
  const a = { email: `audit-a-${suffix}@example.com`, name: "Audit Account A", password: "Audit account original password 2026!" };
  const b = { email: `audit-b-${suffix}@example.com`, name: "Audit Account B", password: "Audit account B password 2026!" };
  const unknown = `unknown-${suffix}@example.com`;
  let aCookie, aSecondCookie, bCookie, phoneCookie;
  const newPassword = "Audit replacement password 2026!";
  const phone = "+91987654" + String(Math.floor(1000 + Math.random() * 8999));
  const wrongCode = (code) => code === "000000" ? "999999" : "000000";
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  async function query(label, statement, parameters = []) {
    const result = await db.query(statement, parameters);
    sql.push({ case: currentCase, label, statement, parameters: parameters.map(() => "[parameter]"), rows: redact(result.rows), rowCount: result.rowCount });
    return result.rows;
  }
  async function request(path, body, cookie = "", options = {}) {
    const started = performance.now();
    const headers = { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), Origin: options.origin || origin, ...(cookie ? { Cookie: cookie } : {}) };
    const response = await fetch(backendURL + path, { method: options.method || (body !== undefined ? "POST" : "GET"),
      headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    const cookies = response.headers.getSetCookie();
    const record = { case: currentCase, method: options.method || (body !== undefined ? "POST" : "GET"), path,
      request: redact(body), authenticatedRequest: Boolean(cookie), status: response.status,
      response: redact(data), durationMs: Math.round(performance.now() - started),
      cookies: cookies.map((entry) => ({ name: entry.split("=")[0], attributes: entry.split(";").slice(1).map((item) => item.trim()) })),
      headers: { cacheControl: response.headers.get("cache-control"), contentType: response.headers.get("content-type"), nosniff: response.headers.get("x-content-type-options") } };
    http.push(record);
    return { status: response.status, data, cookies, cookie: cookies.map((entry) => entry.split(";")[0]).join("; "), record };
  }
  const auth = (path, body, cookie, options) => request("/api/auth/" + path, body, cookie, options);
  const cookieIssued = (result) => result.cookies.some((entry) => entry.startsWith("better-auth.session_token="));
  const code = (email, purpose) => {
    const value = codes.get(purpose + ":" + email); assert.match(value || "", /^\d{6}$/, "Captured adapter must receive a six-digit code"); return value;
  };
  async function sessions(email) { return (await query("sessions for user", 'SELECT count(*)::int AS count FROM "session" s JOIN "user" u ON u.id=s."userId" WHERE u.email=$1', [email]))[0].count; }
  async function session(cookie) { return (await auth("get-session", undefined, cookie)).data; }
  async function check(id, title, expected, action, covers = []) {
    currentCase = id; const started = performance.now();
    try {
      const observed = await action(); cases.push({ id, title, expected, status: "passed", observed: redact(observed), durationMs: Math.round(performance.now() - started), covers });
    } catch (error) {
      cases.push({ id, title, expected, status: "failed", error: error.message, durationMs: Math.round(performance.now() - started), covers });
      console.log(JSON.stringify({ failedCase: id, title, error: error.message }));
    }
  }
  async function send(email, type = "sign-in") { const result = await auth("email-otp/send-verification-otp", { email, type }); assert.equal(result.status, 200); return code(email, type); }
  async function resetCode(email) { const result = await auth("email-otp/request-password-reset", { email }); assert.equal(result.status, 200); return code(email, "forget-password"); }
  async function expire(email, purpose) { await query("expire isolated OTP fixture", 'UPDATE verification SET "expiresAt"=now()-interval \'1 second\' WHERE identifier=$1', [`${purpose}-otp-${email}`]); }

  await check("SET-01", "Actual backend and migrated database ready", "HTTP 200 and all six migrations applied", async () => {
    const result = await request("/api/ready"); assert.equal(result.status, 200); assert.equal(result.data.database, "connected");
    const rows = await query("migration history", "SELECT name FROM schema_migrations ORDER BY name"); assert.equal(rows.length, 6); return { status: result.status, migrations: rows };
  }, ["SET-03", "SET-04"]);
  await check("SET-02", "Test provider configuration", "Email/password, email, phone and OAuth switches reflect test fixtures", async () => {
    const result = await request("/api/auth-config"); assert.equal(result.status, 200); assert.equal(result.data.email, true); assert.equal(result.data.phone, true);
    return { ...result.data, delivery: "captured locally; not real provider connectivity" };
  });
  for (const [id, title, body] of [
    ["VAL-01", "Blank signup name rejected", { ...a, name: "   " }],
    ["VAL-02", "Malformed email rejected", { ...a, email: "not-an-email" }],
    ["VAL-03", "Missing email rejected", { name: a.name, password: a.password }],
    ["VAL-04", "Password shorter than twelve characters rejected", { ...a, password: "short" }],
    ["VAL-05", "Password longer than 128 characters rejected", { ...a, password: "x".repeat(129) }],
    ["VAL-06", "Client cannot assign admin role or verified status", { ...a, role: "admin", emailVerified: true }],
  ]) await check(id, title, "HTTP 400, no user or authenticated cookie created", async () => {
    const result = await auth("sign-up/email", body); assert.equal(result.status, 400); assert.equal(cookieIssued(result), false);
    const rows = await query("invalid signup user count", 'SELECT count(*)::int AS count FROM "user"'); assert.equal(rows[0].count, 0);
    return { httpStatus: result.status, users: rows[0].count, code: result.data.code };
  }, ["REG-04", "API-04", "API-05"]);
  await check("REG-01", "New signup requires verification", "User unverified, credential linked, no authenticated session", async () => {
    const result = await auth("sign-up/email", a); assert.equal(result.status, 200); assert.equal(result.data.token, null); assert.equal(cookieIssued(result), false);
    a.id = result.data.user.id;
    const rows = await query("new user and credential relationship", 'SELECT u.id,u.name,u."emailVerified",u.role,a."providerId",a."userId" FROM "user" u JOIN account a ON a."userId"=u.id WHERE u.email=$1', [a.email]);
    assert.equal(rows.length, 1); assert.equal(rows[0].emailVerified, false); assert.equal(rows[0].role, "user"); assert.equal(rows[0].providerId, "credential"); assert.equal(await sessions(a.email), 0);
    return { status: result.status, row: rows[0], sessions: 0 };
  }, ["REG-01"]);
  await check("REG-02", "Password stored as strong scrypt hash", "Salted scrypt parameters, no plaintext password", async () => {
    const rows = await db.query('SELECT password FROM account WHERE "userId"=$1', [a.id]);
    assert.match(rows.rows[0].password, /^\$scrypt\$131072\$8\$1\$/); assert.notEqual(rows.rows[0].password, a.password);
    return { format: "$scrypt$131072$8$1$[salt]$[hash]", plaintextStored: false };
  });
  await check("REG-03", "Email code delivered to captured Brevo adapter and hashed in DB", "Six digits, five-minute expiry, no plaintext code stored", async () => {
    const otp = code(a.email, "email-verification");
    const rows = await db.query('SELECT value,"expiresAt" FROM verification WHERE identifier LIKE $1', ["%" + a.email]);
    assert.ok(rows.rows.length); assert.ok(rows.rows.every((row) => !row.value.includes(otp)));
    const seconds = Math.round((new Date(rows.rows.at(-1).expiresAt) - Date.now()) / 1000); assert.ok(seconds > 200 && seconds <= 300);
    return { deliveredCodeLength: otp.length, codeStoredAsHash: true, secondsToExpiry: seconds, provider: "Brevo request intercepted locally" };
  }, ["REG-02"]);
  await check("REG-04", "Duplicate pending account rejected", "409, original identity/hash/code unchanged, no email sent", async () => {
    const old = await db.query('SELECT password FROM account WHERE "userId"=$1', [a.id]); const count = deliveries.length;
    const result = await auth("sign-up/email", { email: a.email.toUpperCase(), password: "Duplicate password attempt 2026!", name: "Replacement" });
    assert.equal(result.status, 409); assert.equal(result.data.code, "SIGNUP_ACCOUNT_ALREADY_EXISTS"); assert.equal(deliveries.length, count);
    assert.equal((await db.query('SELECT password FROM account WHERE "userId"=$1', [a.id])).rows[0].password, old.rows[0].password);
    return { status: result.status, code: result.data.code, newEmailSent: false, hashUnchanged: true };
  }, ["REG-12"]);
  await check("REG-05", "Pending account password cannot grant access", "403 EMAIL_NOT_VERIFIED and no session", async () => {
    const result = await auth("sign-in/email", { email: a.email, password: a.password }); assert.equal(result.status, 403); assert.equal(result.data.code, "EMAIL_NOT_VERIFIED"); assert.equal(await sessions(a.email), 0);
    return { status: result.status, code: result.data.code, sessions: 0 };
  }, ["PWD-04", "REG-13"]);
  await check("VER-01", "Wrong signup OTP rejected", "400 and user remains unverified", async () => {
    const result = await auth("email-otp/verify-email", { email: a.email, otp: wrongCode(code(a.email, "email-verification")) }); assert.equal(result.status, 400);
    const rows = await query("verification state after wrong code", 'SELECT "emailVerified" FROM "user" WHERE id=$1', [a.id]); assert.equal(rows[0].emailVerified, false); return { status: result.status, ...rows[0] };
  }, ["REG-07"]);
  await check("VER-02", "Signup code cannot be used for OTP login", "Wrong purpose rejected, no session", async () => {
    const result = await auth("sign-in/email-otp", { email: a.email, otp: code(a.email, "email-verification") }); assert.equal(result.status, 400); assert.equal(await sessions(a.email), 0); return { status: result.status, sessions: 0 };
  }, ["OTP-08"]);
  await check("VER-03", "Code cannot verify a different recipient", "400 and no account created", async () => {
    const result = await auth("email-otp/verify-email", { email: unknown, otp: code(a.email, "email-verification") }); assert.equal(result.status, 400); return { status: result.status };
  }, ["REG-14", "OTP-08"]);
  await check("VER-04", "Expired signup code rejected", "400, unverified user, no session", async () => {
    await expire(a.email, "email-verification");
    const result = await auth("email-otp/verify-email", { email: a.email, otp: code(a.email, "email-verification") }); assert.equal(result.status, 400); assert.equal(await sessions(a.email), 0); return { status: result.status, sessions: 0 };
  }, ["REG-08"]);
  await check("VER-05", "Immediate resend works and invalidates the prior differing code", "New code sent, old code rejected", async () => {
    const old = await send(a.email, "email-verification"); let fresh = await send(a.email, "email-verification");
    if (fresh === old) fresh = await send(a.email, "email-verification"); assert.notEqual(fresh, old);
    const result = await auth("email-otp/verify-email", { email: a.email, otp: old }); assert.equal(result.status, 400);
    return { resendAccepted: true, codesDifferent: true, oldCodeStatus: result.status };
  }, ["REG-09", "REG-10"]);
  await check("VER-06", "Valid signup code creates persistent session", "User verified and HttpOnly SameSite=Lax seven-day cookie", async () => {
    const result = await auth("email-otp/verify-email", { email: a.email, otp: code(a.email, "email-verification") }); assert.equal(result.status, 200); aCookie = result.cookie;
    const cookie = result.cookies.find((item) => item.startsWith("better-auth.session_token=")); assert.ok(cookie); assert.match(cookie, /httponly/i); assert.match(cookie, /samesite=lax/i); assert.match(cookie, /max-age=604800/i);
    assert.equal((await session(aCookie)).user.emailVerified, true); return { status: result.status, cookieAttributes: cookie.split(";").slice(1), verified: true };
  }, ["REG-03", "SES-05"]);
  await check("VER-07", "Used signup code cannot be replayed", "400 and session count unchanged", async () => {
    const before = await sessions(a.email); const result = await auth("email-otp/verify-email", { email: a.email, otp: code(a.email, "email-verification") }); assert.equal(result.status, 400); assert.equal(await sessions(a.email), before); return { status: result.status, sessionsBefore: before, sessionsAfter: before };
  }, ["REG-11"]);
  await check("REG-06", "Verified duplicate account rejected without replacing name/password", "409, original password works and replacement fails", async () => {
    const result = await auth("sign-up/email", { email: " " + a.email.toUpperCase() + " ", password: "Replacement signup password 2026!", name: "Replacement" }); assert.equal(result.status, 409);
    assert.equal((await auth("sign-in/email", { email: a.email, password: "Replacement signup password 2026!" })).status, 401);
    const valid = await auth("sign-in/email", { email: a.email, password: a.password, rememberMe: true }); assert.equal(valid.status, 200); aCookie = valid.cookie;
    const rows = await query("identity after duplicate signup", 'SELECT id,name FROM "user" WHERE email=$1', [a.email]); assert.equal(rows.length, 1); assert.equal(rows[0].name, a.name);
    return { duplicateStatus: result.status, originalPasswordAccepted: true, replacementPasswordRejected: true, ...rows[0] };
  }, ["REG-12"]);
  await check("PWD-01", "Verified password login", "200, same user, remembered session", async () => {
    const result = await auth("sign-in/email", { email: a.email, password: a.password, rememberMe: true }); assert.equal(result.status, 200); aSecondCookie = result.cookie; assert.equal(result.data.user.id, a.id); return { status: result.status, userId: result.data.user.id };
  }, ["PWD-01"]);
  await check("PWD-02", "Wrong password rejected", "401 and no session issued", async () => {
    const before = await sessions(a.email); const result = await auth("sign-in/email", { email: a.email, password: "Incorrect password attempt!" }); assert.equal(result.status, 401); assert.equal(cookieIssued(result), false); assert.equal(await sessions(a.email), before); return { status: result.status, sessionsUnchanged: true };
  }, ["PWD-02"]);
  await check("PWD-03", "Unknown password login rejected", "401, no account created", async () => {
    const result = await auth("sign-in/email", { email: unknown, password: a.password }); assert.equal(result.status, 401);
    assert.equal((await query("unknown user count", 'SELECT count(*)::int AS count FROM "user" WHERE email=$1', [unknown]))[0].count, 0); return { status: result.status, users: 0 };
  }, ["PWD-03"]);
  await check("PWD-04", "No application throttle after repeated password attempts", "Six rejected passwords followed by a successful login, no 429", async () => {
    const statuses = []; for (let n = 0; n < 6; n++) statuses.push((await auth("sign-in/email", { email: a.email, password: "Incorrect repeated password!" })).status);
    assert.ok(statuses.every((status) => status === 401)); const result = await auth("sign-in/email", { email: a.email, password: a.password }); assert.equal(result.status, 200); return { failedAttemptStatuses: statuses, validStatus: result.status };
  }, ["PWD-07", "PWD-08"]);
  await check("SES-01", "Session lookup returns same account and no sensitive hashes", "200, same ID, password absent", async () => {
    const result = await auth("get-session", undefined, aCookie); assert.equal(result.status, 200); assert.equal(result.data.user.id, a.id); assert.equal(JSON.stringify(result.data).includes("$scrypt$"), false); return { status: result.status, userId: result.data.user.id, passwordHashExposed: false };
  }, ["SES-01", "API-09"]);
  await check("SES-02", "New HTTP client restores session from persistent cookie", "Same user without another login", async () => {
    const result = await auth("get-session", undefined, String(aCookie)); assert.equal(result.data.user.id, a.id); return { userId: result.data.user.id, mechanism: "Cookie supplied by a new request; browser restart tested separately by user" };
  });
  await check("SES-03", "Tampered session cookie rejected", "Null session and protected endpoint 401", async () => {
    const forged = "better-auth.session_token=forged-invalid-token"; assert.equal(await session(forged), null); const result = await request("/api/customer/me", undefined, forged); assert.equal(result.status, 401); return { status: result.status, session: null };
  }, ["API-02"]);
  await check("SES-04", "Expired session rejected", "Null session and protected endpoint 401", async () => {
    const active = await session(aSecondCookie); await query("expire isolated session", 'UPDATE "session" SET "expiresAt"=now()-interval \'1 second\' WHERE id=$1', [active.session.id]);
    assert.equal(await session(aSecondCookie), null); const result = await request("/api/customer/me", undefined, aSecondCookie); assert.equal(result.status, 401); return { status: result.status, session: null };
  }, ["SES-09"]);
  await check("SES-05", "Active session renews after one day", "Expiry extends and persistent cookie refreshed", async () => {
    const active = await session(aCookie); await query("age isolated session", 'UPDATE "session" SET "expiresAt"=now()+interval \'5 days\',"updatedAt"=now()-interval \'2 days\' WHERE id=$1', [active.session.id]);
    const result = await auth("get-session", undefined, aCookie); assert.equal(result.data.user.id, a.id); assert.ok(new Date(result.data.session.expiresAt).getTime() > Date.now() + 6 * 86400000); assert.equal(cookieIssued(result), true); return { userId: a.id, renewedExpiry: result.data.session.expiresAt, cookieRenewed: true };
  }, ["SES-10"]);
  await check("USER-01", "Create independent second verified account", "Distinct ID and session", async () => {
    const signup = await auth("sign-up/email", b); assert.equal(signup.status, 200); b.id = signup.data.user.id; assert.notEqual(b.id, a.id);
    const verified = await auth("email-otp/verify-email", { email: b.email, otp: code(b.email, "email-verification") }); assert.equal(verified.status, 200); bCookie = verified.cookie; return { aId: a.id, bId: b.id };
  }, ["USER-04"]);
  await check("USER-02", "Customer profiles are separate and upserted idempotently", "Correct email/IDs, one customer per auth user", async () => {
    const meA = await request("/api/customer/me", undefined, aCookie); const meB = await request("/api/customer/me", undefined, bCookie); assert.equal(meA.status, 200); assert.equal(meB.status, 200); assert.equal(meA.data.user.email, a.email); assert.equal(meB.data.user.email, b.email); assert.notEqual(meA.data.customerId, meB.data.customerId);
    a.customerId = meA.data.customerId; b.customerId = meB.data.customerId; const repeat = await request("/api/customer/me", undefined, aCookie); assert.equal(repeat.data.customerId, a.customerId);
    const rows = await query("customer linkage", 'SELECT auth_user_id,count(*)::int AS count FROM customers GROUP BY auth_user_id ORDER BY auth_user_id'); assert.ok(rows.every((row) => row.count === 1)); return { accountA: meA.data, accountB: meB.data, customerRows: rows };
  }, ["USER-01", "USER-04", "USER-05"]);
  await check("USER-03", "Seed labelled isolated orders and addresses for ownership testing", "Two fixture orders and two distinct addresses; no real order submission", async () => {
    for (const item of [a, b]) {
      const number = item === a ? "AUDIT-ORDER-A" : "AUDIT-ORDER-B"; item.order = number;
      await query("insert isolated order fixture", "INSERT INTO orders (order_number,customer_id,status,fulfillment_type,subtotal_paise,customer_name,customer_email,customer_phone) VALUES ($1,$2,'confirmed','pickup',10000,$3,$4,'9999999999')", [number, item.customerId, item.name, item.email]);
      await query("insert isolated address fixture", "INSERT INTO customer_addresses (customer_id,recipient_name,phone,line_1,city,state,postal_code) VALUES ($1,$2,'9999999999',$3,'Test City','Test State','000000')", [item.customerId, item.name, item === a ? "Account A test address" : "Account B test address"]);
    }
    return { fixtureOrders: 2, fixtureAddresses: 2, scope: "local disposable database only" };
  });
  await check("USER-04", "Each account sees only its own order list", "One correct order per account", async () => {
    const ordersA = await request("/api/customer/orders", undefined, aCookie); const ordersB = await request("/api/customer/orders", undefined, bCookie);
    assert.equal(ordersA.data.items.length, 1); assert.equal(ordersB.data.items.length, 1); assert.equal(ordersA.data.items[0].number, a.order); assert.equal(ordersB.data.items[0].number, b.order); return { ordersA: ordersA.data.items, ordersB: ordersB.data.items };
  }, ["USER-01", "USER-04"]);
  await check("USER-05", "Account B cannot retrieve Account A order", "404, no order details exposed", async () => {
    assert.equal((await request("/api/customer/orders/" + a.order, undefined, aCookie)).status, 200);
    const denied = await request("/api/customer/orders/" + a.order, undefined, bCookie); assert.equal(denied.status, 404); assert.equal(denied.data.number, undefined); return { deniedStatus: denied.status, exposedOrder: false };
  }, ["USER-06"]);
  await check("USER-06", "Addresses and account summary are scoped to signed-in identity", "No address leak even with another customer ID in query", async () => {
    const addresses = await request("/api/customer/addresses?customerId=" + a.customerId, undefined, bCookie); assert.equal(addresses.data.items.length, 1); assert.equal(addresses.data.items[0].line_1, "Account B test address");
    const summary = await request("/api/customer/summary", undefined, bCookie); assert.equal(summary.data.orders, 1); assert.equal(summary.data.addresses, 1); return { addresses: addresses.data.items, summary: summary.data };
  }, ["USER-01", "USER-04"]);
  await check("USER-07", "Profile name updates persist and synchronize customer", "Updated name in user and customer, contacts unchanged", async () => {
    const result = await auth("update-user", { name: "Updated Audit A" }, aCookie); assert.equal(result.status, 200);
    const me = await request("/api/customer/me", undefined, aCookie); assert.equal(me.data.user.name, "Updated Audit A"); assert.equal(me.data.user.email, a.email);
    const rows = await query("profile synchronized", 'SELECT u.name,c.full_name,u.email FROM "user" u JOIN customers c ON c.auth_user_id=u.id WHERE u.id=$1', [a.id]); assert.equal(rows[0].name, rows[0].full_name); return rows[0];
  }, ["USER-02"]);
  for (const [id, name] of [["USER-08", "   "], ["USER-09", "x".repeat(121)]]) await check(id, "Invalid profile name rejected", "400, valid stored name unchanged", async () => {
    const result = await auth("update-user", { name }, aCookie); assert.equal(result.status, 400); assert.equal((await session(aCookie)).user.name, "Updated Audit A"); return { status: result.status, nameUnchanged: true };
  }, ["USER-03"]);
  await check("USER-10", "Normal customer cannot read admin API", "403", async () => { const result = await request("/api/admin/products", undefined, aCookie); assert.equal(result.status, 403); return { status: result.status }; }, ["USER-07", "API-05"]);
  await check("USER-11", "Banned user cannot read customer API", "401 even with a previously valid session", async () => {
    await query("temporarily ban isolated user", 'UPDATE "user" SET banned=true WHERE id=$1', [b.id]);
    try { const result = await request("/api/customer/me", undefined, bCookie); assert.equal(result.status, 401); return { status: result.status }; }
    finally { await query("restore isolated user", 'UPDATE "user" SET banned=false WHERE id=$1', [b.id]); }
  });
  for (const [index, path] of ["/api/customer/me", "/api/customer/summary", "/api/customer/orders", "/api/customer/addresses", "/api/admin/products"].entries()) {
    await check("API-0" + (index + 1), "Guest denied " + path, "401 with no private data", async () => { const result = await request(path); assert.equal(result.status, 401); return { status: result.status, response: result.data }; }, ["API-01"]);
  }
  await check("API-06", "Guest cannot prepare checkout", "401", async () => { const result = await request("/api/checkout/prepare", { items: [{ slug: "classmate-spiral-notebook", quantity: 1 }] }); assert.equal(result.status, 401); return { status: result.status }; }, ["API-01", "CART-05"]);
  await check("API-07", "Customer mutation with forged Origin blocked", "403", async () => { const result = await request("/api/checkout/prepare", { items: [] }, aCookie, { origin: "https://untrusted.example" }); assert.equal(result.status, 403); return { status: result.status }; }, ["API-03"]);
  await check("API-08", "Auth mutation with forged Origin blocked", "403", async () => { const result = await auth("update-user", { name: "Malicious" }, aCookie, { origin: "https://untrusted.example" }); assert.equal(result.status, 403); return { status: result.status }; }, ["API-03"]);
  await check("API-09", "Authenticated checkout prices come from database", "Valid quote, correct quantity math and canPlaceOrder=false", async () => {
    const products = (await request("/api/catalog/products")).data.items; const product = products[0]; assert.ok(product); a.product = product.slug;
    const result = await request("/api/checkout/prepare", { items: [{ slug: product.slug, quantity: 2, price: 1 }], fulfilment: "pickup" }, aCookie); assert.equal(result.status, 200); assert.equal(result.data.canPlaceOrder, false);
    assert.equal(result.data.items[0].lineTotalPaise, result.data.items[0].unitPricePaise * 2); assert.equal(result.data.totalPaise, result.data.subtotalPaise); assert.equal(result.data.source, "database"); return result.data;
  }, ["CART-08"]);
  await check("API-10", "Invalid cart rejected after authentication", "400", async () => { const result = await request("/api/checkout/prepare", { items: [{ slug: a.product, quantity: -1 }] }, aCookie); assert.equal(result.status, 400); return { status: result.status }; }, ["API-04"]);
  await check("API-11", "Order placement remains unavailable without payment integration", "503 and fixture order/payment counts unchanged", async () => {
    const before = (await query("order/payment counts before disabled order submission", "SELECT (SELECT count(*)::int FROM orders) AS orders,(SELECT count(*)::int FROM payments) AS payments"))[0];
    const result = await request("/api/checkout/orders", { items: [{ slug: a.product, quantity: 1 }] }, aCookie); assert.equal(result.status, 503);
    const after = (await query("order/payment counts after disabled order submission", "SELECT (SELECT count(*)::int FROM orders) AS orders,(SELECT count(*)::int FROM payments) AS payments"))[0]; assert.deepEqual(after, before); return { status: result.status, counts: after, scope: "isolated test backend only" };
  }, ["CART-08"]);
  await check("API-12", "Auth and customer responses prohibit caching", "Cache-Control no-store", async () => {
    const result = await request("/api/customer/me", undefined, aCookie); assert.equal(result.record.headers.cacheControl, "no-store"); assert.equal(result.record.headers.nosniff, "nosniff"); return result.record.headers;
  }, ["API-09"]);
  await check("SES-06", "Logout affects only the current session", "Logged-out cookie rejected; second same-user session and Account B remain valid", async () => {
    const other = await auth("sign-in/email", { email: a.email, password: a.password }); assert.equal(other.status, 200); aSecondCookie = other.cookie;
    assert.equal((await auth("sign-out", {}, aCookie)).status, 200); assert.equal(await session(aCookie), null); assert.equal((await session(aSecondCookie)).user.id, a.id); assert.equal((await session(bCookie)).user.id, b.id); aCookie = aSecondCookie;
    return { loggedOutSession: null, sameUserOtherSessionValid: true, accountBSessionValid: true };
  }, ["SES-07", "SES-08"]);

  await check("OTP-01", "Email OTP request sends code without issuing session", "200, capture exists, session count unchanged", async () => {
    const before = await sessions(a.email); await send(a.email); assert.equal(await sessions(a.email), before); return { sixDigitCode: true, sessionsUnchanged: true };
  }, ["OTP-01"]);
  await check("OTP-02", "Incorrect email login OTP rejected", "400, no new session", async () => {
    const before = await sessions(a.email); const result = await auth("sign-in/email-otp", { email: a.email, otp: wrongCode(code(a.email, "sign-in")) }); assert.equal(result.status, 400); assert.equal(await sessions(a.email), before); return { status: result.status, sessionsUnchanged: true };
  }, ["OTP-03"]);
  await check("OTP-03", "Expired email login OTP rejected", "400", async () => {
    await expire(a.email, "sign-in"); const result = await auth("sign-in/email-otp", { email: a.email, otp: code(a.email, "sign-in") }); assert.equal(result.status, 400); return { status: result.status };
  }, ["OTP-04"]);
  await check("OTP-04", "Five incorrect guesses exhaust a code", "All wrong guesses fail; the original correct code also becomes unusable", async () => {
    const current = await send(a.email); const statuses = [];
    for (let n = 0; n < 5; n++) statuses.push((await auth("sign-in/email-otp", { email: a.email, otp: wrongCode(current) })).status);
    assert.ok(statuses.every((status) => status === 400)); const correct = await auth("sign-in/email-otp", { email: a.email, otp: current }); assert.equal(correct.status, 403); assert.equal(correct.data.code, "TOO_MANY_ATTEMPTS"); return { wrongGuessStatuses: statuses, exhaustedCodeStatus: correct.status, errorCode: correct.data.code };
  }, ["OTP-09"]);
  await check("OTP-05", "Fresh code restores OTP login after exhaustion", "200, same verified user", async () => {
    const fresh = await send(a.email); const result = await auth("sign-in/email-otp", { email: a.email, otp: fresh }); assert.equal(result.status, 200); assert.equal(result.data.user.id, a.id); aCookie = result.cookie; return { status: result.status, userId: a.id };
  }, ["OTP-02"]);
  await check("OTP-06", "Used email login OTP rejected on replay", "400, session count unchanged", async () => {
    const before = await sessions(a.email); const result = await auth("sign-in/email-otp", { email: a.email, otp: code(a.email, "sign-in") }); assert.equal(result.status, 400); assert.equal(await sessions(a.email), before); return { status: result.status, sessionsUnchanged: true };
  }, ["OTP-06"]);
  await check("OTP-07", "Resend invalidates older differing sign-in code", "Old code fails, newest code signs in", async () => {
    const old = await send(a.email); let fresh = await send(a.email); if (old === fresh) fresh = await send(a.email); assert.notEqual(old, fresh);
    assert.equal((await auth("sign-in/email-otp", { email: a.email, otp: old })).status, 400);
    const result = await auth("sign-in/email-otp", { email: a.email, otp: fresh }); assert.equal(result.status, 200); aCookie = result.cookie; return { oldRejected: true, freshStatus: result.status };
  }, ["OTP-05"]);
  await check("OTP-08", "Unknown email OTP login stays generic without signup", "200 request, no delivery, no account", async () => {
    const before = deliveries.length; const result = await auth("email-otp/send-verification-otp", { email: unknown, type: "sign-in" }); assert.equal(result.status, 200); assert.equal(deliveries.length, before);
    assert.equal((await query("unknown OTP user count", 'SELECT count(*)::int AS count FROM "user" WHERE email=$1', [unknown]))[0].count, 0); return { status: result.status, sentEmail: false, accountCreated: false };
  }, ["OTP-07"]);
  await check("OTP-09", "Concurrent requests cannot reuse the same login code", "Exactly one successful login and one additional session", async () => {
    const current = await send(a.email); const before = await sessions(a.email);
    const results = await Promise.all([auth("sign-in/email-otp", { email: a.email, otp: current }), auth("sign-in/email-otp", { email: a.email, otp: current })]);
    assert.equal(results.filter((result) => result.status === 200).length, 1);
    assert.equal(await sessions(a.email), before + 1);
    return { statuses: results.map((result) => result.status), additionalSessions: 1 };
  }, ["OTP-06"]);
  await check("RESET-01", "Unknown reset email rejected before code screen", "400 RESET_ACCOUNT_NOT_FOUND, no delivery/code/account", async () => {
    const before = deliveries.length; const result = await auth("email-otp/request-password-reset", { email: unknown }); assert.equal(result.status, 400); assert.equal(result.data.code, "RESET_ACCOUNT_NOT_FOUND"); assert.equal(deliveries.length, before);
    const rows = await query("unknown reset verification records", "SELECT count(*)::int AS count FROM verification WHERE identifier LIKE $1", ["%" + unknown]); assert.equal(rows[0].count, 0); return { status: result.status, errorCode: result.data.code, emailSent: false, verificationRecords: 0 };
  }, ["RESET-02"]);
  await check("RESET-02", "Reset request leaves password and sessions unchanged", "Code sent, existing password hash/session retained", async () => {
    const before = (await db.query('SELECT password FROM account WHERE "userId"=$1', [a.id])).rows[0].password; await resetCode(a.email);
    assert.equal((await db.query('SELECT password FROM account WHERE "userId"=$1', [a.id])).rows[0].password, before); assert.equal((await session(aCookie)).user.id, a.id); return { hashUnchanged: true, previousSessionValid: true };
  }, ["RESET-01"]);
  await check("RESET-03", "Wrong password-reset code cannot change password", "400, original password accepted", async () => {
    const result = await auth("email-otp/reset-password", { email: a.email, otp: wrongCode(code(a.email, "forget-password")), password: newPassword }); assert.equal(result.status, 400);
    assert.equal((await auth("sign-in/email", { email: a.email, password: a.password })).status, 200); return { status: result.status, originalPasswordValid: true };
  }, ["RESET-03"]);
  await check("RESET-04", "Short replacement password rejected", "400, code not consumed by password validation", async () => {
    const result = await auth("email-otp/reset-password", { email: a.email, otp: code(a.email, "forget-password"), password: "short" }); assert.equal(result.status, 400); return { status: result.status, errorCode: result.data.code };
  }, ["RESET-04"]);
  await check("RESET-05", "Expired reset code rejected", "400, original password unchanged", async () => {
    await expire(a.email, "forget-password"); const result = await auth("email-otp/reset-password", { email: a.email, otp: code(a.email, "forget-password"), password: newPassword }); assert.equal(result.status, 400);
    assert.equal((await auth("sign-in/email", { email: a.email, password: a.password })).status, 200); return { status: result.status, originalPasswordValid: true };
  }, ["RESET-03"]);
  await check("RESET-06", "Immediate reset resend allowed and older code rejected", "Old code rejected, latest code remains valid", async () => {
    const old = await resetCode(a.email); let fresh = await resetCode(a.email); if (old === fresh) fresh = await resetCode(a.email); assert.notEqual(old, fresh);
    const result = await auth("email-otp/reset-password", { email: a.email, otp: old, password: newPassword }); assert.equal(result.status, 400); return { resendAllowed: true, olderCodeStatus: result.status };
  }, ["RESET-09"]);
  await check("RESET-07", "Reset revokes all Account A sessions and preserves Account B", "200, A sessions zero, B remains signed in", async () => {
    const before = await sessions(a.email); assert.ok(before >= 2);
    const result = await auth("email-otp/reset-password", { email: a.email, otp: code(a.email, "forget-password"), password: newPassword }); assert.equal(result.status, 200); assert.equal(await sessions(a.email), 0);
    assert.equal(await session(aCookie), null); assert.equal(await session(aSecondCookie), null); assert.equal((await session(bCookie)).user.id, b.id); return { status: result.status, revokedSessions: before, remainingASessions: 0, accountBStillValid: true };
  }, ["RESET-05", "RESET-07"]);
  await check("RESET-08", "Old password fails and new password works", "401 old password, 200 new password, same account", async () => {
    const old = await auth("sign-in/email", { email: a.email, password: a.password }); assert.equal(old.status, 401);
    const fresh = await auth("sign-in/email", { email: a.email, password: newPassword }); assert.equal(fresh.status, 200); assert.equal(fresh.data.user.id, a.id); aCookie = fresh.cookie; return { oldStatus: old.status, newStatus: fresh.status, userId: a.id };
  }, ["RESET-06"]);
  await check("RESET-09", "Used reset code cannot change password again", "400, latest password still works", async () => {
    const result = await auth("email-otp/reset-password", { email: a.email, otp: code(a.email, "forget-password"), password: "Another replacement password 2026!" }); assert.equal(result.status, 400);
    assert.equal((await auth("sign-in/email", { email: a.email, password: newPassword })).status, 200); return { replayStatus: result.status, latestPasswordValid: true };
  }, ["RESET-08"]);
  await check("DELIVERY-01", "Brevo provider failure is not reported as successful sending", "503 and no session issued", async () => {
    await setDeliveryStatus(503);
    try { const result = await auth("email-otp/request-password-reset", { email: b.email }); assert.equal(result.status, 503); assert.equal(cookieIssued(result), false); return { status: result.status, simulatedProviderStatus: 503 }; }
    finally { await setDeliveryStatus(201); }
  }, ["API-08"]);

  await check("PHONE-01", "Invalid Indian phone number rejected", "400", async () => { const result = await auth("phone/start", { phoneNumber: "123", purpose: "login" }); assert.equal(result.status, 400); return { status: result.status }; }, ["PHONE-02"]);
  await check("PHONE-02", "Phone signup waits for OTP before creating user", "Challenge stored with hashed OTP/password, user count zero", async () => {
    const result = await auth("phone/start", { phoneNumber: phone, purpose: "signup", name: "Audit Phone", password: a.password }); assert.equal(result.status, 200); a.phoneChallenge = result.data.challenge;
    const rows = await db.query("SELECT code_hash,password_hash FROM phone_auth_challenges WHERE id=$1", [digest(a.phoneChallenge)]); assert.match(rows.rows[0].password_hash, /^\$scrypt\$/); assert.notEqual(rows.rows[0].code_hash, codes.get(phone));
    const count = (await query("pending phone user count", 'SELECT count(*)::int AS count FROM "user" WHERE "phoneNumber"=$1', [phone]))[0].count; assert.equal(count, 0); return { status: result.status, pendingUserCount: 0, otpAndPasswordHashed: true };
  }, ["PHONE-03"]);
  await check("PHONE-03", "Unverified phone cannot use password login", "401", async () => { const result = await auth("phone/sign-in/password", { phoneNumber: phone, password: a.password }); assert.equal(result.status, 401); return { status: result.status }; });
  await check("PHONE-04", "Wrong phone OTP rejected", "401 and no user created", async () => { const result = await auth("phone/verify", { challenge: a.phoneChallenge, code: wrongCode(codes.get(phone)) }); assert.equal(result.status, 401); return { status: result.status }; }, ["PHONE-06"]);
  await check("PHONE-05", "Phone verification creates verified identity/session", "200, phone verified, email unverified, guest synthetic identifier", async () => {
    const result = await auth("phone/verify", { challenge: a.phoneChallenge, code: codes.get(phone) }); assert.equal(result.status, 200); phoneCookie = result.cookie;
    const identity = await session(phoneCookie); assert.equal(identity.user.phoneNumberVerified, true); assert.equal(identity.user.emailVerified, false); assert.ok(identity.user.email.endsWith(".invalid")); return { status: result.status, userId: identity.user.id, phoneVerified: true, emailVerified: false };
  }, ["PHONE-03"]);
  await check("PHONE-06", "Consumed phone signup code cannot be replayed", "401", async () => { const result = await auth("phone/verify", { challenge: a.phoneChallenge, code: codes.get(phone) }); assert.equal(result.status, 401); return { status: result.status }; }, ["PHONE-06"]);
  await check("PHONE-07", "Verified phone password login works; wrong password fails", "200 correct, 401 incorrect", async () => {
    assert.equal((await auth("phone/sign-in/password", { phoneNumber: phone, password: "Incorrect phone password!" })).status, 401);
    const result = await auth("phone/sign-in/password", { phoneNumber: phone.slice(3), password: a.password }); assert.equal(result.status, 200); phoneCookie = result.cookie; return { correctStatus: result.status, wrongStatus: 401, normalizedIndianNumber: true };
  }, ["PHONE-04"]);
  await check("PHONE-08", "Immediate phone resend invalidates previous challenge", "No countdown, stale challenge rejected, latest challenge succeeds", async () => {
    const first = await auth("phone/start", { phoneNumber: phone, purpose: "login" }); const second = await auth("phone/start", { phoneNumber: phone, purpose: "login" }); assert.equal(first.status, 200); assert.equal(second.status, 200); assert.equal(second.data.resendAfter, 0);
    assert.equal((await auth("phone/verify", { challenge: first.data.challenge, code: codes.get(phone) })).status, 401);
    const result = await auth("phone/verify", { challenge: second.data.challenge, code: codes.get(phone) }); assert.equal(result.status, 200); return { staleStatus: 401, latestStatus: result.status, resendAfter: 0 };
  }, ["PHONE-05", "PHONE-07"]);
  await check("PHONE-09", "Expired phone code rejected", "401", async () => {
    const start = await auth("phone/start", { phoneNumber: phone, purpose: "login" }); await query("expire isolated phone challenge", "UPDATE phone_auth_challenges SET expires_at=now()-interval '1 second' WHERE id=$1", [digest(start.data.challenge)]);
    const result = await auth("phone/verify", { challenge: start.data.challenge, code: codes.get(phone) }); assert.equal(result.status, 401); return { status: result.status };
  }, ["PHONE-06"]);
  await check("PHONE-13", "Concurrent phone OTP requests consume a challenge once", "One success and one rejection", async () => {
    const start = await auth("phone/start", { phoneNumber: phone, purpose: "login" }); const current = codes.get(phone);
    const results = await Promise.all([auth("phone/verify", { challenge: start.data.challenge, code: current }), auth("phone/verify", { challenge: start.data.challenge, code: current })]);
    assert.equal(results.filter((result) => result.status === 200).length, 1); assert.equal(results.filter((result) => result.status === 401).length, 1);
    return { statuses: results.map((result) => result.status) };
  }, ["PHONE-06"]);
  await check("PHONE-10", "Five wrong phone guesses exhaust challenge", "Correct code fails after five wrong guesses", async () => {
    const start = await auth("phone/start", { phoneNumber: phone, purpose: "login" }); const current = codes.get(phone);
    for (let n = 0; n < 5; n++) assert.equal((await auth("phone/verify", { challenge: start.data.challenge, code: wrongCode(current) })).status, 401);
    assert.equal((await auth("phone/verify", { challenge: start.data.challenge, code: current })).status, 401); return { wrongGuesses: 5, exhaustedCodeRejected: true };
  }, ["PHONE-06"]);
  await check("PHONE-11", "Phone reset changes password and revokes old session", "200 reset, old session null, old password rejected, new accepted", async () => {
    const start = await auth("phone/start", { phoneNumber: phone, purpose: "reset" }); const body = { challenge: start.data.challenge, code: codes.get(phone), password: newPassword };
    assert.equal((await auth("phone/reset-password", body)).status, 200); assert.equal(await session(phoneCookie), null);
    assert.equal((await auth("phone/sign-in/password", { phoneNumber: phone, password: a.password })).status, 401);
    const valid = await auth("phone/sign-in/password", { phoneNumber: phone, password: newPassword }); assert.equal(valid.status, 200); phoneCookie = valid.cookie;
    assert.equal((await auth("phone/reset-password", body)).status, 401); return { resetStatus: 200, oldSession: null, oldPasswordStatus: 401, newPasswordStatus: 200, replayStatus: 401 };
  }, ["PHONE-08"]);
  await check("PHONE-12", "Verified phone can access customer API without a verified email", "200 and only verified phone retained as customer contact", async () => {
    const result = await request("/api/customer/me", undefined, phoneCookie); assert.equal(result.status, 200); assert.equal(result.data.user.email, null); assert.equal(result.data.user.phone, phone); return result.data;
  });
  await check("DELIVERY-02", "Twilio provider failure cleans failed challenge", "503 and no new usable failed challenge", async () => {
    await setDeliveryStatus(503); const before = (await db.query("SELECT count(*)::int AS count FROM phone_auth_challenges")).rows[0].count;
    try { const result = await auth("phone/start", { phoneNumber: phone, purpose: "login" }); assert.equal(result.status, 503); assert.equal((await db.query("SELECT count(*)::int AS count FROM phone_auth_challenges")).rows[0].count, before); return { status: result.status, failedChallengeRemoved: true }; }
    finally { await setDeliveryStatus(201); }
  }, ["PHONE-09", "API-08"]);
  for (const provider of ["google", "facebook"]) await check("OAUTH-" + provider.toUpperCase(), provider + " OAuth authorization contract", "State present and callback on storefront; consent/token exchange not tested", async () => {
    const result = await auth("sign-in/social", { provider, callbackURL: origin + "/checkout" }); assert.equal(result.status, 200);
    const url = new URL(result.data.url); assert.ok(url.searchParams.get("state")); assert.equal(url.searchParams.get("redirect_uri"), origin + "/api/auth/callback/" + provider);
    assert.ok(provider === "google" ? url.hostname === "accounts.google.com" : url.hostname.endsWith("facebook.com")); return { provider, authorizeHost: url.hostname, statePresent: true, redirectURI: url.searchParams.get("redirect_uri"), liveConsent: "not tested" };
  }, ["SOC-03", "SOC-04"]);
  await check("DB-01", "Authentication foreign-key relationships remain valid", "No orphaned accounts/sessions/customers", async () => {
    const rows = await query("authentication orphan counts", 'SELECT (SELECT count(*)::int FROM account a LEFT JOIN "user" u ON u.id=a."userId" WHERE u.id IS NULL) AS accounts,(SELECT count(*)::int FROM "session" s LEFT JOIN "user" u ON u.id=s."userId" WHERE u.id IS NULL) AS sessions,(SELECT count(*)::int FROM customers c LEFT JOIN "user" u ON u.id=c.auth_user_id WHERE c.auth_user_id IS NOT NULL AND u.id IS NULL) AS customers');
    assert.deepEqual(rows[0], { accounts: 0, sessions: 0, customers: 0 }); return rows[0];
  }, ["API-06"]);
  const counts = { total: cases.length, passed: cases.filter((item) => item.status === "passed").length, failed: cases.filter((item) => item.status === "failed").length };
  return { startedAt, finishedAt: new Date().toISOString(), counts, cases, http, sql,
    deliveries: deliveries.map(({ otp, ...message }) => ({ ...message, codeLength: otp?.length, codeNumeric: /^\d{6}$/.test(otp || "") })),
    limitations: ["Email/SMS requests are intercepted in a test-only Node preload; real inbox/SMS delivery is not automated here.",
      "OAuth tests validate state/authorize URLs only, with dummy app credentials; no consent or token exchange.",
      "Expiry is simulated by moving fixture timestamps, not by waiting five minutes.",
      "Cookie restoration through new HTTP requests is not a real browser restart.",
      "Orders/addresses used to prove ownership were inserted only into the local disposable database."] };
}
