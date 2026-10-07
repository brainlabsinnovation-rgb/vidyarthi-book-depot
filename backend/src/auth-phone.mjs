import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { APIError, createAuthEndpoint, formCsrfMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { validatePassword } from "./password-security.mjs";

export function normalizePhone(value) {
  const digits = String(value ?? "").replace(/[\s()-]/g, "");
  const phone = /^\d{10}$/.test(digits) ? "+91" + digits : digits;
  if (!/^\+91[6-9]\d{9}$/.test(phone)) throw new APIError("BAD_REQUEST", { message: "Enter a valid Indian mobile number." });
  return phone;
}
const failure = () => new APIError("UNAUTHORIZED", { message: "The phone number, password or code could not be verified." });
const unavailable = () => new APIError("SERVICE_UNAVAILABLE", { message: "SMS verification is not configured yet." });
const digest = (value) => createHash("sha256").update(value).digest("hex");
export function phoneAuth({ database, delivery, secret }) {
  const mac = (value) => createHmac("sha256", secret).update(value).digest("hex");
  let dummyHash;
  async function findUser(phone) {
    const result = await database.query('SELECT * FROM "user" WHERE "phoneNumber"=$1', [phone]);
    return result.rows[0];
  }
  async function signIn(ctx, user) {
    if (!user || !user.phoneNumberVerified) throw failure();
    const session = await ctx.context.internalAdapter.createSession(user.id);
    if (!session) throw failure();
    await setSessionCookie(ctx, { session, user });
    return ctx.json({ status: true });
  }
  const start = createAuthEndpoint("/phone/start", {
    method: "POST", use: [formCsrfMiddleware],
    body: z.object({ phoneNumber: z.string().max(25), purpose: z.enum(["signup", "login", "reset"]),
      name: z.string().trim().min(1).max(120).optional(), password: z.string().max(128).optional() }),
  }, async (ctx) => {
    if (!delivery.phoneEnabled) throw unavailable();
    const phone = normalizePhone(ctx.body.phoneNumber);
    if (ctx.body.purpose === "signup") { validatePassword(ctx.body.password); if (!ctx.body.name) throw new APIError("BAD_REQUEST", { message: "Enter your name." }); }
    const user = await findUser(phone);
    const token = randomBytes(32).toString("base64url");
    const id = digest(token);
    const code = String(randomInt(0, 1000000)).padStart(6, "0");
    const passwordHash = ctx.body.purpose === "signup" && !user ? await ctx.context.password.hash(ctx.body.password) : null;
    await database.query("UPDATE phone_auth_challenges SET used_at=now() WHERE phone=$1 AND purpose=$2 AND used_at IS NULL", [phone, ctx.body.purpose]);
    await database.query("DELETE FROM phone_auth_challenges WHERE expires_at < now()-interval '1 day'");
    await database.query(`INSERT INTO phone_auth_challenges (id,phone,purpose,user_id,full_name,password_hash,code_hash,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,now()+interval '5 minutes')`,
      [id, phone, ctx.body.purpose, user?.id ?? null, ctx.body.name ?? null, passwordHash, mac(id + ":" + code)]);
    if (ctx.body.purpose === "signup" || user?.phoneNumberVerified) {
      try { await delivery.sendPhone({ phoneNumber: phone, code }); }
      catch { await database.query("DELETE FROM phone_auth_challenges WHERE id=$1", [id]); throw unavailable(); }
    }
    return ctx.json({ challenge: token, expiresIn: 300, resendAfter: 0 });
  });
  async function consume(token, code, expectedPurpose) {
    const client = await database.connect();
    let row;
    let invalid = false;
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT * FROM phone_auth_challenges WHERE id=$1 FOR UPDATE", [digest(token)]);
      row = result.rows[0];
      if (!row || row.used_at || new Date(row.expires_at) <= new Date() || row.attempts >= 5 ||
          (expectedPurpose && row.purpose !== expectedPurpose)) invalid = true;
      else {
        const valid = timingSafeEqual(Buffer.from(row.code_hash, "hex"), Buffer.from(mac(row.id + ":" + code), "hex"));
        await client.query("UPDATE phone_auth_challenges SET attempts=attempts+1, used_at=CASE WHEN $2 THEN now() ELSE used_at END WHERE id=$1", [row.id, valid]);
        invalid = !valid;
      }
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
    if (invalid) throw failure();
    return row;
  }
  const verify = createAuthEndpoint("/phone/verify", {
    method: "POST", use: [formCsrfMiddleware],
    body: z.object({ challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/), code: z.string().regex(/^\d{6}$/) }),
  }, async (ctx) => {
    const row = await consume(ctx.body.challenge, ctx.body.code);
    if (row.purpose === "reset") throw failure();
    let user;
    if (row.purpose === "signup") {
      if (row.user_id || await findUser(row.phone)) throw new APIError("CONFLICT", { message: "This number already has an account. Please sign in." });
      user = await ctx.context.internalAdapter.createUser({
        name: row.full_name, email: "phone-" + mac(row.phone).slice(0, 32) + "@phone.vidyarthi.invalid",
        emailVerified: false, phoneNumber: row.phone, phoneNumberVerified: true, role: "user",
      });
      await ctx.context.internalAdapter.linkAccount({ userId: user.id, providerId: "credential", accountId: user.id, password: row.password_hash });
    } else {
      if (!row.user_id) throw failure();
      user = await ctx.context.internalAdapter.findUserById(row.user_id);
    }
    return signIn(ctx, user);
  });
  const passwordSignIn = createAuthEndpoint("/phone/sign-in/password", {
    method: "POST", use: [formCsrfMiddleware],
    body: z.object({ phoneNumber: z.string().max(25), password: z.string().max(128) }),
  }, async (ctx) => {
    const phone = normalizePhone(ctx.body.phoneNumber);
    const user = await findUser(phone);
    const account = user ? await ctx.context.internalAdapter.findCredentialAccount(user.id) : null;
    dummyHash ??= ctx.context.password.hash(randomBytes(32).toString("hex"));
    const valid = await ctx.context.password.verify({ hash: account?.password || await dummyHash, password: ctx.body.password });
    if (!valid || !user?.phoneNumberVerified) throw failure();
    return signIn(ctx, user);
  });
  const reset = createAuthEndpoint("/phone/reset-password", {
    method: "POST", use: [formCsrfMiddleware],
    body: z.object({ challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/), code: z.string().regex(/^\d{6}$/), password: z.string().max(128) }),
  }, async (ctx) => {
    validatePassword(ctx.body.password);
    const row = await consume(ctx.body.challenge, ctx.body.code, "reset");
    if (!row.user_id) throw failure();
    await ctx.context.internalAdapter.updatePassword(row.user_id, await ctx.context.password.hash(ctx.body.password));
    await ctx.context.internalAdapter.deleteUserSessions(row.user_id);
    return ctx.json({ status: true });
  });
  return { id: "vidyarthi-phone", endpoints: { startPhoneAuth: start, verifyPhoneAuth: verify, signInPhonePassword: passwordSignIn, resetPhonePassword: reset } };
}
