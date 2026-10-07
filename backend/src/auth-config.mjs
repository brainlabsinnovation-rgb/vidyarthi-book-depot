import { createHmac } from "node:crypto";
import { betterAuth } from "better-auth";
import { admin, emailOTP } from "better-auth/plugins";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { hashPassword, verifyPassword } from "./password-security.mjs";
import { phoneAuth } from "./auth-phone.mjs";

export function createCustomerAuth({ database, delivery, env = process.env }) {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("BETTER_AUTH_SECRET must have at least 32 characters");
  const origin = env.FRONTEND_ORIGIN || "http://localhost:3000";
  const publicURL = env.BETTER_AUTH_URL || origin;
  const socialProviders = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) socialProviders.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
  if (env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET) socialProviders.facebook = { clientId: env.FACEBOOK_CLIENT_ID, clientSecret: env.FACEBOOK_CLIENT_SECRET };
  const emailReady = () => { if (!delivery.emailEnabled) throw new APIError("SERVICE_UNAVAILABLE", { message: "Email verification is not configured yet. Please use another sign-in method." }); };
  return betterAuth({
    database, secret, baseURL: publicURL, trustedOrigins: [origin],
    emailAndPassword: { enabled: true, disableSignUp: false, autoSignIn: false, requireEmailVerification: true,
      minPasswordLength: 12, maxPasswordLength: 128, revokeSessionsOnPasswordReset: true,
      password: { hash: hashPassword, verify: verifyPassword } },
    emailVerification: { autoSignInAfterVerification: true },
    user: { additionalFields: {
      phoneNumber: { type: "string", required: false, unique: true, input: false },
      phoneNumberVerified: { type: "boolean", required: false, defaultValue: false, input: false },
    } },
    account: { accountLinking: { enabled: false }, encryptOAuthTokens: true },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, freshAge: 300, cookieCache: { enabled: false } },
    advanced: { useSecureCookies: publicURL.startsWith("https://"), disableOriginCheck: false, disableCSRFCheck: false,
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" } },
    rateLimit: { enabled: false },
    socialProviders,
    hooks: { before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email" || ctx.path?.startsWith("/email-otp/") || ctx.path === "/sign-in/email-otp") emailReady();
      if (["/email-otp/request-password-reset", "/forget-password/email-otp"].includes(ctx.path)) {
        const email = typeof ctx.body.email === "string" ? ctx.body.email.trim().toLowerCase() : "";
        const account = email ? await ctx.context.internalAdapter.findUserByEmail(email) : null;
        if (!account) throw new APIError("BAD_REQUEST", {
          code: "RESET_ACCOUNT_NOT_FOUND", message: "No account found with this email. Please create an account.",
        });
        ctx.body.email = email;
      }
      if (ctx.path === "/update-user" && ctx.body.name !== undefined && (!ctx.body.name?.trim() || ctx.body.name.trim().length > 120)) throw new APIError("BAD_REQUEST", { message: "Enter a valid name." });
      if (ctx.path === "/sign-up/email") {
        const email = typeof ctx.body.email === "string" ? ctx.body.email.trim().toLowerCase() : "";
        if (!ctx.body.name?.trim() || ctx.body.name.trim().length > 120 || !email || email.endsWith(".invalid"))
          throw new APIError("BAD_REQUEST", { message: "Enter your name and a valid email address." });
        if (await ctx.context.internalAdapter.findUserByEmail(email)) throw new APIError("CONFLICT", {
          code: "SIGNUP_ACCOUNT_ALREADY_EXISTS", message: "An account already exists with this email. Please sign in.",
        });
        ctx.body.email = email;
      }
    }) },
    logger: { level: "error" },
    plugins: [admin({ defaultRole: "user" }), emailOTP({
      expiresIn: 300, otpLength: 6, allowedAttempts: 5, disableSignUp: true,
      overrideDefaultEmailVerification: true, sendVerificationOnSignUp: true,
      storeOTP: { hash: async (otp) => createHmac("sha256", secret).update("email-otp:" + otp).digest("hex") },
      sendVerificationOTP: delivery.sendEmail,
    }), phoneAuth({ database, delivery, secret }), {
      id: "vidyarthi-required-auth-delivery",
      // These tasks send required verification codes. Surface provider failures
      // instead of reporting success after the library logs and swallows them.
      init() { return { context: { async runInBackgroundOrAwait(task) { await task; } } }; },
    }],
  });
}
