import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID, randomInt } from "node:crypto";
import pg from "pg";
import { createCustomerAuth } from "../src/auth-config.mjs";
import { hashPassword, verifyPassword } from "../src/password-security.mjs";
import { requireCustomer, customerForUser } from "../src/customer-account.mjs";
import { createDelivery } from "../src/auth-delivery.mjs";

function assertPersistentSession(result) {
  const cookie = result.cookies.find((value) => value.startsWith("better-auth.session_token="));
  assert.ok(cookie, "A website session cookie must be issued");
  assert.match(cookie, /max-age=604800/i, "Cookie must persist for seven days");
  assert.match(cookie, /httponly/i);
  assert.match(cookie, /samesite=lax/i);
}
test("password hashes are salted, strong and verify safely", async () => {
  const password = "My test passphrase 2026!";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.match(first, /^\$scrypt\$131072\$8\$1\$/);
  assert.equal(await verifyPassword({ hash: first, password }), true);
  assert.equal(await verifyPassword({ hash: first, password: "incorrect password" }), false);
  await assert.rejects(hashPassword("short"));
});
test("unconfigured delivery never pretends to send a code", async () => {
  const delivery = createDelivery({});
  assert.equal(delivery.emailEnabled, false); assert.equal(delivery.phoneEnabled, false);
  await assert.rejects(delivery.sendEmail({ email: "nobody@example.com", otp: "123456", type: "sign-in" }));
  await assert.rejects(delivery.sendPhone({ phoneNumber: "+919999999999", code: "123456" }));
});

test("database-backed customer authentication", { skip: !process.env.AUTH_TEST_DATABASE_URL }, async (t) => {
  const url = new URL(process.env.AUTH_TEST_DATABASE_URL);
  assert.ok(["localhost","127.0.0.1"].includes(url.hostname), "Use a disposable local PostgreSQL database");
  const db = new pg.Pool({ connectionString: url.toString(), max: 5 });
  const codes = new Map();
  const sentEmails = [];
  const delivery = { emailEnabled: true, phoneEnabled: true,
    sendEmail: async ({ email, otp, type }) => { sentEmails.push({ email, type }); codes.set(type + ":" + email, otp); },
    sendPhone: async ({ phoneNumber, code }) => { codes.set(phoneNumber, code); } };
  const env = { BETTER_AUTH_SECRET: "test-only-" + randomUUID(), FRONTEND_ORIGIN: "http://localhost:3000", BETTER_AUTH_URL: "http://localhost:3000" };
  const auth = createCustomerAuth({ database: db, delivery, env });
  let requestNumber = 0;
  async function request(path, body, cookie = "", origin = env.FRONTEND_ORIGIN) {
    const headers = { Origin: origin, "x-forwarded-for": "127.0.0.1", "x-test-request": String(++requestNumber) };
    if (body) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    const response = await auth.handler(new Request("http://localhost:3000/api/auth/" + path, { method: body ? "POST" : "GET", headers, ...(body ? { body: JSON.stringify(body) } : {}) }));
    const data = await response.json();
    const cookies = response.headers.getSetCookie?.() || [response.headers.get("set-cookie") || ""];
    return { status: response.status, data, cookie: cookies.map((c) => c.split(";")[0]).filter(Boolean).join("; "), cookies };
  }
  const email = "auth-test-" + randomUUID() + "@example.com";
  const password = "A long test passphrase 2026!";
  let emailCookie;
  async function assertDuplicateSignupRejected() {
    const snapshot = async () => ({
      users: (await db.query('SELECT * FROM "user" WHERE email=$1', [email])).rows,
      accounts: (await db.query('SELECT a.* FROM account a JOIN "user" u ON u.id=a."userId" WHERE u.email=$1 ORDER BY a.id', [email])).rows,
      codes: (await db.query('SELECT * FROM verification WHERE identifier LIKE $1 ORDER BY id', ["%" + email])).rows,
    });
    const before = await snapshot(); const sentBefore = sentEmails.length;
    for (const address of [email, email.toUpperCase(), " " + email + " "]) {
      const duplicate = await request("sign-up/email", { name: "Replacement Name", email: address, password: "Different duplicate signup password!" });
      assert.equal(duplicate.status, 409, JSON.stringify(duplicate.data));
      assert.equal(duplicate.data.code, "SIGNUP_ACCOUNT_ALREADY_EXISTS");
      assert.equal(duplicate.cookies.some((cookie) => cookie.startsWith("better-auth.session_token=")), false);
    }
    assert.deepEqual(await snapshot(), before, "Duplicate signup must not change the user, password hash or verification records");
    assert.equal(sentEmails.length, sentBefore, "Duplicate signup must not send an email");
  }
  try {
    await t.test("signup requires verification and rejects client-supplied roles", async () => {
      const malicious = await request("sign-up/email", { email, password, name: "Auth Test", role: "admin", emailVerified: true });
      assert.equal(malicious.status, 400);
      const signup = await request("sign-up/email", { email, password, name: "Auth Test" });
      assert.equal(signup.status, 200, JSON.stringify(signup.data));
      assert.equal(signup.data.token, null);
      const stored = await db.query('SELECT u."emailVerified",u.role,a.password FROM "user" u JOIN account a ON a."userId"=u.id WHERE u.email=$1', [email]);
      assert.equal(stored.rows[0].emailVerified, false); assert.equal(stored.rows[0].role, "user");
      assert.match(stored.rows[0].password, /^\$scrypt\$/);
      const verification = await db.query("SELECT value FROM verification WHERE identifier LIKE $1", ["%" + email]);
      assert.ok(verification.rows.length);
      assert.ok(verification.rows.every((row) => !row.value.includes(codes.get("email-verification:" + email))));
      // Avoid resending a code through password sign-in while verification is pending.
      const session = await request("get-session");
      assert.equal(session.data, null);
    });
    await t.test("duplicate signup for an unverified account is rejected without changing its details or code", assertDuplicateSignupRejected);
    await t.test("wrong OTP is rejected; valid OTP is single-use and creates an HttpOnly session", async () => {
      const code = codes.get("email-verification:" + email);
      const wrong = await request("email-otp/verify-email", { email, otp: code === "000000" ? "999999" : "000000" });
      assert.equal(wrong.status, 400);
      const verified = await request("email-otp/verify-email", { email, otp: code });
      assert.equal(verified.status, 200, JSON.stringify(verified.data)); emailCookie = verified.cookie; assertPersistentSession(verified);
      assert.ok(verified.cookies.some((cookie) => /httponly/i.test(cookie)));
      assert.ok(verified.cookies.some((cookie) => /samesite=lax/i.test(cookie)));
      const replay = await request("email-otp/verify-email", { email, otp: code });
      assert.equal(replay.status, 400);
      const session = await request("get-session", undefined, emailCookie);
      assert.equal(session.data.user.emailVerified, true); assert.equal(session.data.user.role, "user");
    });
    await t.test("duplicate signup for a verified account is rejected and cannot replace its password", async () => {
      await assertDuplicateSignupRejected();
      assert.equal((await request("sign-in/email", { email, password: "Different duplicate signup password!" })).status, 401);
      assert.equal((await request("sign-in/email", { email, password })).status, 200);
    });
    await t.test("account and checkout guard rejects guests and links verified customers", async () => {
      await assert.rejects(requireCustomer(auth, new Headers()), (error) => error.status === 401);
      const session = await requireCustomer(auth, new Headers({ Cookie: emailCookie }));
      const customer = await customerForUser(db, session.user);
      assert.equal(customer.email, email);
      const second = await customerForUser(db, session.user);
      assert.equal(customer.id, second.id);
    });
    await t.test("password sign-in rejects bad passwords and accepts correct ones", async () => {
      const bad = await request("sign-in/email", { email, password: "Wrong test password!" }); assert.equal(bad.status, 401);
      const good = await request("sign-in/email", { email, password, rememberMe: true }); assert.equal(good.status, 200, JSON.stringify(good.data)); assertPersistentSession(good);
      assert.equal((await request("get-session", undefined, good.cookie)).data.user.email, email);
    });
    await t.test("repeated reset requests and password attempts are not throttled by legacy counters", async () => {
      for (const scope of ["email-send-minute", "email-send-hour", "email-password"]) {
        const key = createHmac("sha256", env.BETTER_AUTH_SECRET).update(scope + ":" + email).digest("hex");
        await db.query("INSERT INTO auth_contact_limits (key,count,last_request) VALUES ($1,100,now()) ON CONFLICT (key) DO UPDATE SET count=100,last_request=now()", [key]);
      }
      for (let attempt = 0; attempt < 12; attempt++) {
        const reset = await request("email-otp/request-password-reset", { email });
        assert.equal(reset.status, 200, JSON.stringify(reset.data));
      }
      assert.ok(codes.get("forget-password:" + email));
      for (let attempt = 0; attempt < 6; attempt++) {
        const invalid = await request("sign-in/email", { email, password: "Incorrect test password!" });
        assert.equal(invalid.status, 401, JSON.stringify(invalid.data));
      }
      const valid = await request("sign-in/email", { email, password });
      assert.equal(valid.status, 200, JSON.stringify(valid.data));
    });
    await t.test("returning clients keep their session and active sessions renew after one day", async () => {
      const before = await request("get-session", undefined, emailCookie);
      assert.equal(before.status, 200);
      assert.equal(before.data.user.email, email);
      await db.query('UPDATE "session" SET "expiresAt"=now()+interval \'5 days\',"updatedAt"=now()-interval \'2 days\' WHERE id=$1', [before.data.session.id]);
      const renewed = await request("get-session", undefined, emailCookie);
      assert.equal(renewed.data.user.id, before.data.user.id);
      assert.ok(new Date(renewed.data.session.expiresAt).getTime() > Date.now()+6*24*60*60*1000);
      assertPersistentSession(renewed);
    });
    await t.test("password reset requires OTP, revokes old sessions and invalidates old password", async () => {
      const reset = await request("email-otp/request-password-reset", { email });
      assert.equal(reset.status, 200, JSON.stringify(reset.data));
      const newPassword = "A different long passphrase 2026!";
      const complete = await request("email-otp/reset-password", { email, otp: codes.get("forget-password:" + email), password: newPassword });
      assert.equal(complete.status, 200, JSON.stringify(complete.data));
      assert.equal((await request("get-session", undefined, emailCookie)).data, null);
      assert.equal((await request("sign-in/email", { email, password })).status, 401);
      assert.equal((await request("sign-in/email", { email, password: newPassword })).status, 200);
    });
    await t.test("password reset rejects unknown emails without sending a code or creating records", async () => {
      const unknown = "unknown-reset-" + randomUUID() + "@example.com";
      for (const path of ["email-otp/request-password-reset", "forget-password/email-otp"]) {
        const result = await request(path, { email: unknown });
        assert.equal(result.status, 400, JSON.stringify(result.data));
        assert.equal(result.data.code, "RESET_ACCOUNT_NOT_FOUND");
        assert.equal(result.data.message, "No account found with this email. Please create an account.");
        assert.equal(codes.has("forget-password:" + unknown), false);
      }
      assert.equal((await db.query('SELECT id FROM "user" WHERE email=$1', [unknown])).rows.length, 0);
      assert.equal((await db.query('SELECT id FROM verification WHERE identifier LIKE $1', ["%" + unknown])).rows.length, 0);
    });
    await t.test("email OTP login works, expired codes fail, and unknown accounts receive a generic reply", async () => {
      const sent = await request("email-otp/send-verification-otp", { email, type: "sign-in" });
      assert.equal(sent.status, 200);
      const signedIn = await request("sign-in/email-otp", { email, otp: codes.get("sign-in:" + email) });
      assert.equal(signedIn.status, 200); assertPersistentSession(signedIn);
      await request("email-otp/send-verification-otp", { email, type: "sign-in" });
      await db.query("UPDATE verification SET \"expiresAt\"=now()-interval '1 second' WHERE identifier LIKE $1", ["%" + email]);
      assert.equal((await request("sign-in/email-otp", { email, otp: codes.get("sign-in:" + email) })).status, 400);
      const unknown = "unknown-" + randomUUID() + "@example.com";
      assert.equal((await request("email-otp/send-verification-otp", { email: unknown, type: "sign-in" })).status, 200);
      assert.equal(codes.has("sign-in:" + unknown), false);
    });
    await t.test("Google and Facebook authorize URLs use the storefront callback with state", async () => {
      const oauth = createCustomerAuth({ database: db, delivery, env: { ...env, GOOGLE_CLIENT_ID: "test-google", GOOGLE_CLIENT_SECRET: "test-secret", FACEBOOK_CLIENT_ID: "test-facebook", FACEBOOK_CLIENT_SECRET: "test-secret" } });
      for (const provider of ["google", "facebook"]) {
        const response = await oauth.handler(new Request("http://localhost:3000/api/auth/sign-in/social", {
          method: "POST", headers: { Origin: env.FRONTEND_ORIGIN, "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
          body: JSON.stringify({ provider, callbackURL: "http://localhost:3000/checkout" }),
        }));
        const data = await response.json();
        assert.equal(response.status, 200, JSON.stringify(data));
        const authorize = new URL(data.url);
        assert.ok(authorize.searchParams.get("state"));
        assert.equal(authorize.searchParams.get("redirect_uri"), "http://localhost:3000/api/auth/callback/" + provider);
      }
    });
    const phone = "+9198" + String(randomInt(10000000,99999999));
    let phoneCookie;
    await t.test("phone signup verifies OTP before creating an account; role input is ignored", async () => {
      const started = await request("phone/start", { purpose: "signup", phoneNumber: phone, password, name: "Phone Test", role: "admin" });
      assert.equal(started.status, 200, JSON.stringify(started.data));
      const pending = await db.query('SELECT id FROM "user" WHERE "phoneNumber"=$1', [phone]); assert.equal(pending.rows.length, 0);
      const verification = await db.query("SELECT code_hash,password_hash FROM phone_auth_challenges WHERE phone=$1", [phone]);
      assert.notEqual(verification.rows[0].code_hash, codes.get(phone)); assert.match(verification.rows[0].password_hash, /^\$scrypt\$/);
      const finished = await request("phone/verify", { challenge: started.data.challenge, code: codes.get(phone) });
      assert.equal(finished.status, 200, JSON.stringify(finished.data)); phoneCookie = finished.cookie; assertPersistentSession(finished);
      assert.equal((await request("phone/verify", { challenge: started.data.challenge, code: codes.get(phone) })).status, 401);
      const session = await request("get-session", undefined, phoneCookie);
      assert.equal(session.data.user.phoneNumberVerified, true); assert.equal(session.data.user.role, "user");
    });
    await t.test("verified phone supports password or OTP login and immediate resend", async () => {
      const passwordLogin = await request("phone/sign-in/password", { phoneNumber: phone, password });
      assert.equal(passwordLogin.status, 200); assertPersistentSession(passwordLogin);
      assert.equal((await request("phone/sign-in/password", { phoneNumber: phone, password: "Wrong phone password!" })).status, 401);
      const started = await request("phone/start", { phoneNumber: phone, purpose: "login" });
      assert.equal(started.status, 200);
      const resend = await request("phone/start", { phoneNumber: phone, purpose: "login" }); assert.equal(resend.status, 200);
      assert.equal(resend.data.resendAfter, 0);
      assert.equal((await request("phone/verify", { challenge: started.data.challenge, code: codes.get(phone) })).status, 401);
      const signedIn = await request("phone/verify", { challenge: resend.data.challenge, code: codes.get(phone) });
      assert.equal(signedIn.status, 200); assertPersistentSession(signedIn);
    });
    await t.test("expired phone code is rejected and forged origin is blocked", async () => {
      const started = await request("phone/start", { phoneNumber: phone, purpose: "login" });
      assert.equal(started.status, 200);
      await db.query("UPDATE phone_auth_challenges SET expires_at=now()-interval '1 second' WHERE phone=$1", [phone]);
      assert.equal((await request("phone/verify", { challenge: started.data.challenge, code: codes.get(phone) })).status, 401);
      assert.equal((await request("sign-in/email", { email, password }, "", "https://untrusted.example")).status, 403);
    });
    await t.test("phone password reset revokes sessions, rejects the old password and consumes its OTP", async () => {
      const started = await request("phone/start", { phoneNumber: phone, purpose: "reset" });
      assert.equal(started.status, 200, JSON.stringify(started.data));
      const newPassword = "New phone test passphrase 2026!";
      const resetBody = { challenge: started.data.challenge, code: codes.get(phone), password: newPassword };
      const reset = await request("phone/reset-password", resetBody);
      assert.equal(reset.status, 200, JSON.stringify(reset.data));
      assert.equal((await request("get-session", undefined, phoneCookie)).data, null);
      assert.equal((await request("phone/reset-password", resetBody)).status, 401);
      assert.equal((await request("phone/sign-in/password", { phoneNumber: phone, password })).status, 401);
      const signedIn = await request("phone/sign-in/password", { phoneNumber: phone, password: newPassword });
      assert.equal(signedIn.status, 200); phoneCookie = signedIn.cookie;
    });
    await t.test("sign-out removes the server session", async () => {
      assert.equal((await request("sign-out", {}, phoneCookie)).status, 200);
      assert.equal((await request("get-session", undefined, phoneCookie)).data, null);
    });
  } finally { await db.end(); }
});
